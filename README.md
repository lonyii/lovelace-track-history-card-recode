# Track History Card Recode

> 基于原版 lovelace‑track‑history‑card 修改重制。在地图上展示 Home Assistant `device_tracker` 设备的当日（或选定日期）历史轨迹、停留点、时间线与统计信息，底图使用 CARTO 瓦片并自动跟随 HA 主题（亮/暗）切换。

## ✨ 功能特性

- 🗺️ 自动切换浅色/深色 CARTO 地图瓦片，跟随 HA `system/light/dark` 主题
- 📍 多设备轨迹：显示起点/终点/停留点，自动聚合相邻点
- 📅 日期选择器，可回看任意一天的历史轨迹
- 🧭 路径方向箭头（数量可调），自动按缩放级别抽稀
- ⏱️ 时间线 + 统计摘要：里程、均速、极速、停留时长
- 🛰️ 反向地理编码：停留点显示地址，支持 AMap（高德）与 BigDataCloud
- ▶️ 轨迹回放动画
- 🎨 可视化卡片编辑器（仪表盘内直接编辑配置，无需手写 YAML）

## 📦 安装方式（HACS）

1. 打开 HACS → 右上角菜单 → **Custom repositories**
2. 仓库地址填：`https://github.com/lonyii/lovelace-track-history-card-recode`
3. 类别选择 `Dashboard`，点击添加
4. 在 HACS 搜索 `Track History Card Recode`，点击 `INSTALL`
5. 刷新 Lovelace 前端页面

## 🛠️ 基础配置示例

```yaml
type: custom:lovelace-track-history-card
title: 轨迹历史
entities:
  - device_tracker.my_phone
  - device_tracker.car
default_entity: device_tracker.my_phone
theme: system            # system (默认, 跟随 HA) | light | dark
units: metric            # metric (默认) | imperial
show_arrows: true        # 默认 true
arrow_count: 30          # 10–30, 默认 30
show_timeline: true      # 默认关闭
cluster_radius: 200      # 50–500 米, 默认 200
min_points: 3            # 2–5, 默认 3
```

## 🔑 地图 Key 配置（重要）

原代码中内置了高德 (AMap) 反向地理编码 Key 与 CARTO 底图 Key。**为避免公开仓库中泄露个人 Key，本版本已移除所有内置 Key**，改为在卡片配置中按需填入：

```yaml
type: custom:lovelace-track-history-card
entities:
  - device_tracker.my_phone
reverse_geocode: true
geocode_provider: amap    # amap (默认) | bigdatacloud
amap_key: 你的高德Web服务Key       # 选择 amap 提供商时必填
carto_key: 你的CARTO底图Key         # 可选；不填则使用 CARTO 公共瓦片
```

### 在仪表盘可视化编辑器中填写 Key

1. 在仪表盘中点击该卡片 → 右下角 ✏️ 编辑
2. 展开 **高级 (Advanced)** 折叠区域
3. 在 **高德地图 API Key** 与 **CARTO 底图 API Key** 两个输入框中分别填入你的 Key
4. 关闭编辑器，配置自动保存；地图底图与反向地理编码会立即使用新 Key

> 提示：默认（不填 Key 时）高德反向地理编码将无法工作，CARTO 底图则退回公共瓦片（受 CARTO 公共配额限制）。建议两者都填入你自己的 Key。

### 如何获取 Key

- **高德 (AMap) Key**：到 [console.amap.com](https://console.amap.com/) 注册账号 → 应用管理 → 创建"Web 服务"类型 Key。
- **CARTO Key**：到 [carto.com](https://carto.com/) 注册账号，创建 API Key 即可（用于 basemaps.cartocdn.com 瓦片鉴权）。

## 📋 配置参数

| 参数 | 可选值 / 类型 | 默认 | 说明 |
|---|---|---|---|
| `type` | `custom:lovelace-track-history-card` | — | 必填，固定值 |
| `entities` | 实体 ID 列表 | — | 必填，`device_tracker.*` 实体 ID 数组 |
| `default_entity` | 实体 ID | 列表第一项 | 默认显示的设备 |
| `title` | 字符串 | 无 | 卡片标题；不填则不显示标题栏 |
| `theme` | `system` / `light` / `dark` | `system` | 底图明暗模式 |
| `units` | `metric` / `imperial` | `metric` | 距离/速度单位 |
| `cluster_radius` | 50–500 | 200 | 停留点聚合半径（米） |
| `min_points` | 2–5 | 3 | 形成停留点的最少定位数 |
| `show_arrows` | 布尔 | `true` | 路径方向箭头 |
| `arrow_count` | 10–30 | 30 | 方向箭头数量 |
| `show_timeline` | 布尔 | `false` | 是否显示时间线与统计 |
| `reverse_geocode` | 布尔 | `false` | 是否对停留点做反向地理编码 |
| `geocode_provider` | `amap` / `bigdatacloud` | `amap` | 反向地理编码提供商 |
| `geocode_url` | URL | 无 | 自定义反向地理编码端点（覆盖提供商默认 URL） |
| `amap_key` | 字符串 | 空 | **高德 Web 服务 Key**；`geocode_provider: amap` 时必填 |
| `carto_key` | 字符串 | 空 | **CARTO 底图 Key**；可选，用于瓦片鉴权 |

## 💡 使用提示

1. `theme: system` 只有在 HA 切换深/浅色模式时才会自动更换底图。
2. 历史轨迹依赖 `device_tracker` 实体在 `recorder` 中的历史数据，请确保对应实体未被排除记录。
3. 反向地理编码结果按"语言 + 坐标"缓存在浏览器 `localStorage`，有效期 90 天；切换 HA 语言会重新请求。
4. 修改卡片配置后，刷新浏览器页面即可生效；通过可视化编辑器修改会即时保存。
5. 如果你自行 fork 仓库，**请勿**将个人 Key 重新写回代码——继续使用 `amap_key` / `carto_key` 配置项填入。

## 📄 License

MIT License
