import { watch } from 'chokidar';
import { globSync } from 'glob';
import HTMLInlineCSSWebpackPluginModule from 'html-inline-css-webpack-plugin';
import HtmlInlineScriptWebpackPlugin from 'html-inline-script-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import _ from 'lodash';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import RemarkHTML from 'remark-html';
import { Server } from 'socket.io';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import unpluginAutoImport from 'unplugin-auto-import/webpack';
import {
  VueUseComponentsResolver,
  VueUseDirectiveResolver,
} from 'unplugin-vue-components/resolvers';
import unpluginVueComponents from 'unplugin-vue-components/webpack';
import { VueLoaderPlugin } from 'vue-loader';
import webpack from 'webpack';
import WebpackObfuscator from 'webpack-obfuscator';

const HTMLInlineCSSWebpackPlugin =
  (HTMLInlineCSSWebpackPluginModule as any).default || HTMLInlineCSSWebpackPluginModule;

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Config {
  port: number;
  entries: Entry[];
}
interface Entry {
  script: string;
  html?: string;
}

function parse_entry(script_file: string) {
  const html = path.join(path.dirname(script_file), 'index.html');
  if (fs.existsSync(html)) {
    return { script: script_file, html };
  }
  return { script: script_file };
}

function common_path(lhs: string, rhs: string) {
  const lhs_parts = lhs.split(path.sep);
  const rhs_parts = rhs.split(path.sep);
  for (let i = 0; i < Math.min(lhs_parts.length, rhs_parts.length); i++) {
    if (lhs_parts[i] !== rhs_parts[i]) {
      return lhs_parts.slice(0, i).join(path.sep);
    }
  }
  return lhs_parts.join(path.sep);
}

function glob_script_files() {
  const files: string[] = globSync(`src/**/index.{ts,tsx,js,jsx}`).filter(
    file =>
      process.env.CI !== 'true' || !fs.readFileSync(path.join(__dirname, file)).includes('@no-ci'),
  );

  const results: string[] = [];
  const handle = (file: string) => {
    const file_dirname = path.dirname(file);
    for (const [index, result] of results.entries()) {
      const result_dirname = path.dirname(result);
      const common = common_path(result_dirname, file_dirname);
      if (common === result_dirname) {
        return;
      }
      if (common === file_dirname) {
        results.splice(index, 1, file);
        return;
      }
    }
    results.push(file);
  };
  files.forEach(handle);
  return results;
}

const config: Config = {
  port: 6621,
  entries: glob_script_files().map(parse_entry),
};

let io: Server;
function watch_it(compiler: webpack.Compiler) {
  if (compiler.options.watch) {
    if (!io) {
      const port = config.port ?? 6621;
      io = new Server(port, { cors: { origin: '*' } });
      console.info(`[Listener] 已启动酒馆监听服务, 正在监听: http://0.0.0.0:${port}`);
      io.on('connect', socket => {
        console.info(`[Listener] 成功连接到酒馆网页 '${socket.id}', 初始化推送...`);
        io.emit('iframe_updated');
        socket.on('disconnect', reason => {
          console.info(`[Listener] 与酒馆网页 '${socket.id}' 断开连接: ${reason}`);
        });
      });
    }

    compiler.hooks.done.tap('updater', () => {
      console.info('\n[Listener] 检测到完成编译, 推送更新事件...');
      if (compiler.options.plugins.find(plugin => plugin instanceof HtmlWebpackPlugin)) {
        io.emit('message_iframe_updated');
      } else {
        io.emit('script_iframe_updated');
      }
    });
  }
}

// schema dump 相关状态
const SchemaDump = {
  initialized: false,
  hasSchemaFiles: null as boolean | null,

  /** 检测 src 目录下是否存在 schema.ts 文件 */
  detectSchemaFiles(): boolean {
    if (this.hasSchemaFiles === null) {
      this.hasSchemaFiles = globSync('src/**/schema.ts').length > 0;
    }
    return this.hasSchemaFiles;
  },
};

function dump_schema(compiler: webpack.Compiler) {
  // 单例模式 + 按需执行：仅在存在 schema.ts 时初始化一次
  if (SchemaDump.initialized) return;
  if (!SchemaDump.detectSchemaFiles()) return;
  SchemaDump.initialized = true;

  const execute = () => {
    exec('pnpm dump', { cwd: __dirname });
    console.info('\x1b[36m[schema_dump]\x1b[0m 已将所有 schema.ts 转换为 schema.json');
  };
  const executeDebounced = _.debounce(execute, 500, { leading: true, trailing: false });

  if (!compiler.options.watch) {
    executeDebounced();
  } else {
    watch('src', {
      awaitWriteFinish: true,
    }).on('all', (_event, changedPath) => {
      if (changedPath.endsWith('schema.ts')) {
        executeDebounced();
      }
    });
  }
}

// 公共配置常量 (DRY 原则)

/** ts-loader 公共配置 */
const TsLoaderOptions = {
  transpileOnly: true,
  onlyCompileBundledFiles: true,
  compilerOptions: {
    noUnusedLocals: false,
    noUnusedParameters: false,
  },
} as const;

/** css-loader 基础配置 */
const CssLoaderOptionsBase = { url: false } as const;

/** css-loader 模块化配置 */
const CssLoaderOptionsModules = {
  url: false,
  esModule: false,
  modules: {
    localIdentName: '[name]__[local]--[hash:base64:5]',
    namedExport: false,
  },
} as const;

/** 通用排除规则 */
const ExcludeNodeModules = /node_modules/;

// 规则生成工厂函数
type AssetType = 'asset/source' | 'asset/inline';

interface ResourceQueryRuleOptions {
  resourceQuery: RegExp;
  type: AssetType;
}

/**
 * 生成带 resourceQuery 的规则集
 * @description 用于 ?raw 和 ?url 导入的统一处理
 */
function createResourceQueryRules({
  resourceQuery,
  type,
}: ResourceQueryRuleOptions): webpack.RuleSetRule[] {
  return [
    {
      test: /\.tsx?$/,
      loader: 'ts-loader',
      options: TsLoaderOptions,
      resourceQuery,
      type,
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.(sa|sc)ss$/,
      use: ['postcss-loader', 'sass-loader'],
      resourceQuery,
      type,
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.css$/,
      use: ['postcss-loader'],
      resourceQuery,
      type,
      exclude: ExcludeNodeModules,
    },
    {
      resourceQuery,
      type,
      exclude: ExcludeNodeModules,
    },
  ];
}

/**
 * 生成无 HTML 入口时的样式规则
 * @description 使用 vue-style-loader 和 style-loader
 */
function createNoHtmlStyleRules(): webpack.RuleSetRule[] {
  return [
    {
      test: /\.vue\.s(a|c)ss$/,
      use: [
        { loader: 'vue-style-loader', options: { ssrId: true } },
        { loader: 'css-loader', options: CssLoaderOptionsBase },
        'postcss-loader',
        'sass-loader',
      ],
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.vue\.css$/,
      use: [
        { loader: 'vue-style-loader', options: { ssrId: true } },
        { loader: 'css-loader', options: CssLoaderOptionsBase },
        'postcss-loader',
      ],
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.s(a|c)ss$/,
      use: [
        'style-loader',
        { loader: 'css-loader', options: CssLoaderOptionsBase },
        'postcss-loader',
        'sass-loader',
      ],
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.css$/,
      use: [
        'style-loader',
        { loader: 'css-loader', options: CssLoaderOptionsBase },
        'postcss-loader',
      ],
      exclude: ExcludeNodeModules,
    },
  ];
}

/**
 * 生成有 HTML 入口时的样式规则
 * @description 使用 MiniCssExtractPlugin.loader 提取 CSS
 */
function createHtmlStyleRules(): webpack.RuleSetRule[] {
  return [
    {
      test: /\.module\.s(a|c)ss$/,
      use: [
        MiniCssExtractPlugin.loader,
        { loader: 'css-loader', options: CssLoaderOptionsModules },
        'postcss-loader',
        'sass-loader',
      ],
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.s(a|c)ss$/,
      use: [
        MiniCssExtractPlugin.loader,
        { loader: 'css-loader', options: CssLoaderOptionsBase },
        'postcss-loader',
        'sass-loader',
      ],
      exclude: [ExcludeNodeModules, /\.module\.s(a|c)ss$/],
    },
    {
      test: /\.module\.css$/,
      use: [
        MiniCssExtractPlugin.loader,
        { loader: 'css-loader', options: CssLoaderOptionsModules },
        'postcss-loader',
      ],
      exclude: ExcludeNodeModules,
    },
    {
      test: /\.css$/,
      use: [
        MiniCssExtractPlugin.loader,
        { loader: 'css-loader', options: CssLoaderOptionsBase },
        'postcss-loader',
      ],
      exclude: [ExcludeNodeModules, /\.module\.css$/],
    },
  ];
}

// 配置生成函数
function parse_configuration(entry: Entry): (_env: any, argv: any) => webpack.Configuration {
  const should_obfuscate = fs
    .readFileSync(path.join(__dirname, entry.script), 'utf-8')
    .includes('@obfuscate');
  const script_filepath = path.parse(entry.script);

  return (_env, argv) => ({
    experiments: {
      outputModule: true,
    },
    performance: {
      hints: argv.mode === 'production' ? 'warning' : false,
      maxAssetSize: 1024 * 1024, // 1 MiB
      maxEntrypointSize: 1024 * 1024, // 1 MiB
    },
    devtool: argv.mode === 'production' ? 'hidden-source-map' : 'eval-source-map',
    watchOptions: {
      ignored: ['**/dist', '**/node_modules'],
    },
    entry: path.join(__dirname, entry.script),
    target: 'browserslist',
    output: {
      devtoolNamespace: 'tavern_helper_template',
      devtoolModuleFilenameTemplate: info => {
        const resource_path = decodeURIComponent(info.resourcePath.replace(/^\.\//, ''));
        const is_direct = info.allLoaders === '';
        const is_vue_script =
          resource_path.match(/\.vue$/) &&
          info.query.match(/\btype=script\b/) &&
          !info.allLoaders.match(/\bts-loader\b/);

        return `${is_direct === true ? 'src' : 'webpack'}://${info.namespace}/${resource_path}${is_direct || is_vue_script ? '' : '?' + info.hash}`;
      },
      filename: `${script_filepath.name}.js`,
      path: path.join(
        __dirname,
        'dist',
        path.relative(path.join(__dirname, 'src'), script_filepath.dir),
      ),
      chunkFilename: `${script_filepath.name}.[contenthash].chunk.js`,
      asyncChunks: true,
      clean: true,
      publicPath: '',
      library: {
        type: 'module',
      },
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          use: 'vue-loader',
          exclude: ExcludeNodeModules,
        },
        {
          oneOf: [
            // ?raw 导入规则
            ...createResourceQueryRules({ resourceQuery: /raw/, type: 'asset/source' }),
            // ?url 导入规则
            ...createResourceQueryRules({ resourceQuery: /url/, type: 'asset/inline' }),
            // TypeScript 默认规则
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: TsLoaderOptions,
              exclude: ExcludeNodeModules,
            },
            // HTML 规则
            {
              test: /\.html$/,
              use: 'html-loader',
              exclude: ExcludeNodeModules,
            },
            // Markdown 规则
            {
              test: /\.md$/,
              use: [
                { loader: 'html-loader' },
                {
                  loader: 'remark-loader',
                  options: {
                    remarkOptions: {
                      plugins: [RemarkHTML],
                    },
                  },
                },
              ],
            },
            // 样式规则 (DRY: 使用工厂函数)
            ...(entry.html === undefined ? createNoHtmlStyleRules() : createHtmlStyleRules()),
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.tsx', '.jsx', '.css'],
      plugins: [
        new TsconfigPathsPlugin({
          extensions: ['.ts', '.js', '.tsx', '.jsx'],
          configFile: path.join(__dirname, 'tsconfig.json'),
        }),
      ],
      alias: {},
    },
    plugins: (entry.html === undefined
      ? [new MiniCssExtractPlugin()]
      : [
          new HtmlWebpackPlugin({
            template: path.join(__dirname, entry.html),
            filename: path.parse(entry.html).base,
            scriptLoading: 'module',
            cache: false,
          }),
          new HtmlInlineScriptWebpackPlugin(),
          new MiniCssExtractPlugin(),
          new HTMLInlineCSSWebpackPlugin({
            styleTagFactory({ style }: { style: string }) {
              return `<style>${style}</style>`;
            },
          }),
        ]
    )
      .concat(
        { apply: watch_it },
        { apply: dump_schema },
        new VueLoaderPlugin(),
        unpluginAutoImport({
          dts: true,
          dtsMode: 'overwrite',
          imports: [
            'vue',
            'pinia',
            '@vueuse/core',
            { from: 'dedent', imports: [['default', 'dedent']] },
            { from: 'klona', imports: ['klona'] },
            { from: 'vue-final-modal', imports: ['useModal'] },
            { from: 'zod', imports: ['z'] },
          ],
        }),
        unpluginVueComponents({
          dts: true,
          syncMode: 'overwrite',
          // globs: ['src/panel/component/*.vue'],
          resolvers: [VueUseComponentsResolver(), VueUseDirectiveResolver()],
        }),
        new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
        new webpack.DefinePlugin({
          __VUE_OPTIONS_API__: false,
          __VUE_PROD_DEVTOOLS__: process.env.CI !== 'true',
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
          // 注入版本号用于 CDN 缓存破坏
          __APP_VERSION__: JSON.stringify(
            JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8')).version,
          ),
        }),
      )
      .concat(
        should_obfuscate
          ? [
              new WebpackObfuscator({
                controlFlowFlattening: true,
                numbersToExpressions: true,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                seed: 1,
              }),
            ]
          : [],
      ),
    optimization: {
      minimize: true,
      minimizer: [
        argv.mode === 'production'
          ? new TerserPlugin({
              terserOptions: {
                format: { quote_style: 1 },
                mangle: { reserved: ['_', 'toastr', 'YAML', '$', 'z'] },
              },
            })
          : new TerserPlugin({
              extractComments: false,
              terserOptions: {
                format: { beautify: true, indent_level: 2 },
                compress: false,
                mangle: false,
              },
            }),
      ],
      splitChunks: {
        chunks: 'async',
        minSize: 20000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
          },
          default: {
            name: 'default',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    },
    externals: ({ context, request }, callback) => {
      if (!context || !request) {
        return callback();
      }

      if (
        request.startsWith('-') ||
        request.startsWith('.') ||
        request.startsWith('/') ||
        request.startsWith('!') ||
        request.startsWith('http') ||
        request.startsWith('@/') ||
        path.isAbsolute(request) ||
        fs.existsSync(path.join(context, request)) ||
        fs.existsSync(request)
      ) {
        return callback();
      }

      if (
        ['vue', 'vue-router'].every(key => request !== key) &&
        ['vue', 'react', 'zustand'].some(key => request.includes(key))
      ) {
        return callback();
      }
      const global = {
        jquery: '$',
        lodash: '_',
        showdown: 'showdown',
        toastr: 'toastr',
        vue: 'Vue',
        'vue-router': 'VueRouter',
        yaml: 'YAML',
        zod: 'z',
      };
      if (request in global) {
        return callback(null, 'var ' + global[request as keyof typeof global]);
      }
      const cdn = {
        sass: 'https://jspm.dev/sass',
      };
      return callback(
        null,
        'module-import ' +
          (cdn[request as keyof typeof cdn] ??
            `https://testingcf.jsdelivr.net/npm/${request}/+esm`),
      );
    },
  });
}

export default config.entries.map(parse_configuration);
