export type MapSourceKey = 'small' | 'large';

export interface MapSourceConfig {
  key: MapSourceKey;
  name: string;
  url: string;
}

export const mapSourceList: MapSourceConfig[] = [
  {
    key: 'small',
    name: '高清地图',
    url: 'https://i.ibb.co/S4WC1Cfg/image.webp',
  },
  {
    key: 'large',
    name: '超清地图',
    url: 'https://files.catbox.moe/siuf3g.png',
  },
];
