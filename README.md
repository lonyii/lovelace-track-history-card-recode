# Track History Card Recode \- 基于原版 lovelace\-track\-history\-card 的修改重制版

# \[README\.md\]\(README\.md\)

```markdown
# Track History Card Recode
[![Image](tos-cn-i-a9rns2rl98/rc/online_import/c4586762c9cf41d4b592b18ef5d4b3ba)](https://hacs.xyz)

> 基于原版 lovelace‑track‑history‑card 修改重制，支持 Carto 明暗底图自动跟随 Home Assistant 主题切换，用于在地图上展示设备轨迹与历史位置。

## ✨ 功能特性
- 🗺️ 自动切换浅色/深色 CARTO 地图瓦片，跟随 HA `auto/light/dark` 主题模式
- 📍 多设备追踪，显示实时位置与历史行驶轨迹
- 📅 自定义历史时间范围，支持日期选择器管理时间区间
- 📌 标记聚合（Marker clustering）优化多点显示效果
- 🗂️ 支持 WMS / GeoJSON / 自定义瓦片图层扩展
- 🎨 自适应卡片尺寸，可自定义标题与地图中心点

## 📦 安装方式（HACS 一键安装）
1. 打开 HACS → 右上角菜单 → **Custom repositories**
2. 填入仓库地址：
```

[https://github\.com/lonyii/lovelace\-track\-history\-card\-recode](https://github.com/lonyii/lovelace-track-history-card-recode)

```Plain Text
3. 类别选择：`Dashboard`，点击添加
4. 在 HACS 搜索 `Track History Card Recode`，点击 `INSTALL`
5. 重启 Home Assistant，刷新 Lovelace 前端页面

## 🛠️ 基础配置示例
```yaml
type: custom:track-history-card-recode
title: 车辆轨迹监控
theme_mode: auto
x: 28.68
y: 115.86
zoom: 12
card_size: 5
cluster_markers: false
history_date_selection: true
entities:
  - entity: device_tracker.car
    name: 我的车辆
    show_path: true
```

### 主要配置参数

|参数|可选值|说明|
|---|---|---|
|`theme_mode`|`auto` / `light` / `dark`|地图底图明暗模式，`auto`跟随系统主题|
|`x` / `y`|数字|地图默认中心点经纬度|
|`zoom`|数字|地图默认缩放等级|
|`card_size`|数字|卡片高度尺寸|
|`cluster_markers`|`true` / `false`|是否开启点位聚合|
|`history_date_selection`|`true` / `false`|是否启用时间选择面板|
|`entities`|实体列表|需要展示轨迹的位置追踪设备|

## 📝 进阶扩展

- 支持额外自定义瓦片图层 `tile_layers`

- 支持 WMS 服务图层 `wms`

- 支持 GeoJSON 地理数据图层 `geojson`

- 开启 `debug: true` 在浏览器控制台输出调试日志

## 💡 使用提示

1. `theme_mode: auto` 只有在 HA 深色模式切换时才会自动更换底图

2. 历史轨迹依赖设备追踪实体的历史数据库记录

3. 修改卡片配置后，刷新浏览器页面即可生效

## 📄 License

MIT License
