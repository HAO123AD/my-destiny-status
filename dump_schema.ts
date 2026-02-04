/* eslint-disable */
// @ts-nocheck
import _ from 'lodash';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import z from 'zod';

// 获取当前文件所在目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

globalThis._ = _;
globalThis.z = z;

fs.globSync('src/**/schema.ts').forEach(async schema_file => {
  try {
    const absolutePath = path.resolve(__dirname, schema_file);
    const fileUrl = pathToFileURL(absolutePath).href;
    const module = await import(fileUrl);

    if (_.has(module, 'Schema')) {
      const schema = _.get(module, 'Schema');
      if (_.isFunction(schema)) {
        schema = schema();
      }
      const jsonSchema = z.toJSONSchema(schema, { io: 'input', reused: 'ref' });
      fs.writeFileSync(
        path.join(path.dirname(schema_file), 'schema.json'),
        JSON.stringify(jsonSchema, null, 2),
      );
    }
  } catch (e) {
    console.error(`生成 '${schema_file}' 对应的 schema.json 失败: ${e}`);
  }
});
