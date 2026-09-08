# Track History Card Recode

> 基于 [lovelace-track-history-card](https://github.com/custom-cards/lovelace-track-history-card) 修改重制的 Home Assistant Lovelace 卡片。在地图上展示 `device_tracker` 设备的历史轨迹、起点/终点/停留点、时间线与统计信息，底图使用 CARTO 瓦片并自动跟随 HA 主题（亮/暗）切换。

[![hacs_badge](https://img.shields.io/badge/HACS-Dashboard-31ADF2.svg)](https://github.com/hacs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 目录

- [✨ 功能特性](#-功能特性)
- [📦 安装方式](#-安装方式)
- [🚀 快速开始](#-快速开始)
- [📋 配置参数](#-配置参数)
- [🔑 地图 Key 配置](#-地图-key-配置)
- [🎨 可视化编辑器](#-可视化编辑器)
- [🛰️ 反向地理编码](#-反向地理编码)
- [❓ 常见问题 FAQ](#-常见问题-faq)
- [🐛 故障排查](#-故障排查)
- [📝 更新日志](#-更新日志)
- [📄 License](#license)

## ✨ 功能特性

- 🗺️ **底图自动切换**：CARTO 浅色/深色瓦片跟随 HA `system / light / dark` 主题
- 📍 **多设备轨迹**：同时配置多个 `device_tracker`，显示起点 / 终点 / 中途停留点
- 📅 **历史回看**：日期选择器支持查看任意一天的轨迹
- 🧭 **方向箭头**：路径上方向箭头（10–30 个可调），按缩放级别自动抽稀
- ⏱️ **时间线与统计**：里程、均速、极速、停留时长一目了然
- 🛰️ **反向地理编码**：停留点显示地址，支持高德 (AMap) 与 BigDataCloud
- ▶️ **轨迹回放**：按时间顺序播放当日移动过程
- 🎨 **可视化编辑器**：仪表盘内直接编辑，无需手写 YAML
- 🌐 **多语言**：内置简体中文与英文，跟随 HA 语言

## 📦 安装方式

### 方式一：HACS（推荐）

1. 打开 HACS → 右上角菜单 → **Custom repositories**
2. 仓库地址填入：`https://github.com/lonyii/lovelace-track-history-card-recode`
3. 类别选择 `Dashboard`，点击 **添加**
4. 在 HACS 搜索 `Track History Card Recode`，点击 **INSTALL**
5. 刷新 Lovelace 前端页面

### 方式二：手动安装

1. 下载 [track-history-card-recode.js](track-history-card-recode.js) 到 HA 的 `www/community/lovelace-track-history-card-recode/` 目录
2. 在 `configuration.yaml` 中（如已启用）确认 Lovelace 资源：

   ```yaml
   lovelace:
     resources:
       - url: /community/lovelace-track-history-card-recode/track-history-card-recode.js
         type: module
   ```

3. 重启 Home Assistant 或刷新浏览器

## 🚀 快速开始

最简配置（在仪表盘"手动卡片"中粘贴）：

```yaml
type: custom:lovelace-track-history-card
entities:
  - device_tracker.my_phone
```

完整配置示例：

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
reverse_geocode: true    # 默认关闭；开启后停留点会显示地址
geocode_provider: amap   # amap (默认) | bigdatacloud
amap_key: 你的高德Web服务Key  # 选 amap 时必填（见下节）
carto_key: 你的CARTO底图Key    # 可选；不填使用 CARTO 公共瓦片
```

## 📋 配置参数

| 参数 | 类型 / 可选值 | 默认 | 说明 |
|---|---|---|---|
| `type` | `custom:lovelace-track-history-card` | — | 必填，固定值 |
| `entities` | 实体 ID 列表 | — | 必填，`device_tracker.*` 实体 ID 数组 |
| `default_entity` | 实体 ID | 列表第一项 | 默认显示的设备 |
| `title` | 字符串 | 无 | 卡片标题；不填则不显示标题栏 |
| `theme` | `system` / `light` / `dark` | `system` | 底图明暗模式 |
| `units` | `metric` / `imperial` | `metric` | 距离 / 速度单位 |
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

> 数值字段在 `setConfig` 与编辑器中都会被限制在 `[min, max]` 区间，超出范围会自动取边界值；非法或留空回退到默认值。

## 🔑 地图 Key 配置

原版代码内置了作者个人的高德 (AMap) 与 CARTO Key。**为避免公开仓库泄露个人 Key，本版本已移除所有内置 Key**，改为在卡片配置中按需填入。

### 默认行为（不填 Key 时）

| 功能 | 默认行为 | 影响 |
|---|---|---|
| 高德反向地理编码 | 请求会失败 | 不会显示停留点地址（地图与轨迹正常） |
| CARTO 底图 | 使用 CARTO 公共瓦片 | 受公共配额限制，高频访问可能被限流 |

> 建议两者都填入你自己的 Key，以获得稳定体验。

### 如何获取 Key

- **高德 (AMap) Key**
  1. 访问 [console.amap.com](https://console.amap.com/) 注册账号
  2. 应用管理 → 我的应用 → 创建新应用
  3. 应用类型选 **Web 服务**，复制 Key
  4. 填入卡片配置 `amap_key` 或编辑器对应输入框
- **CARTO Key**
  1. 访问 [carto.com](https://carto.com/) 注册账号
  2. 进入用户设置 → API Keys → 创建新 Key
  3. 复制 Key 填入卡片配置 `carto_key`

### YAML 示例

```yaml
type: custom:lovelace-track-history-card
entities:
  - device_tracker.my_phone
reverse_geocode: true
geocode_provider: amap
amap_key: 1234567890abcdef1234567890abcdef
carto_key: cb1_xxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🎨 可视化编辑器

本卡内置可视化编辑器，无需手写 YAML 即可配置所有选项。

### 编辑步骤

1. 在仪表盘右上角点击 ✏️ **编辑仪表盘**
2. 点击本卡片右下角的 ✏️ 图标
3. 在右侧面板展开 **高级 (Advanced)** 折叠区域
4. 修改任意字段会自动保存
5. 在 **高级** 区域可填写：
   - 高德地图 API Key（选择 AMap 作为地理编码提供商时必填）
   - CARTO 底图 API Key（可选，用于瓦片鉴权）

### 编辑器字段对应

| 编辑器字段 | YAML 参数 |
|---|---|
| 追踪设备 | `entities` |
| 默认设备 | `default_entity` |
| 标题 | `title` |
| 方向箭头 / 数量 | `show_arrows` / `arrow_count` |
| 时间线 | `show_timeline` |
| 主题 | `theme` |
| 单位 | `units` |
| 聚合半径 | `cluster_radius` |
| 每个聚合的最小点数 | `min_points` |
| 反向地理编码 | `reverse_geocode` |
| 地理编码提供商 | `geocode_provider` |
| 高德地图 API Key | `amap_key` |
| CARTO 底图 API Key | `carto_key` |

## 🛰️ 反向地理编码

本卡对"停留点"（速度接近 0 持续一段时间的聚类点）做反向地理编码，显示街道 / 地名信息。

### 支持的提供商

| 提供商 | 需 Key | 适用地区 | 备注 |
|---|---|---|---|
| `amap`（高德） | ✅ 必填 (`amap_key`) | 中国大陆 | 自动 WGS84 → GCJ02 坐标转换 |
| `bigdatacloud` | ❌ 不需要 | 全球 | 免费公共 API，无需注册 |

### 自定义端点

通过 `geocode_url` 可指向任意兼容 Nominatim / 反向地理编码的端点（LocationIQ、自建服务等）：

```yaml
reverse_geocode: true
geocode_url: https://nominatim.example.com/reverse
```

### 缓存策略

- 结果按 `语言 + 坐标` 缓存在浏览器 `localStorage`
- 有效期 90 天
- 切换 HA 语言会重新请求
- 请求串行化（≥1.1 秒间隔），遵守公共 API 限速约定

## ❓ 常见问题 FAQ

**Q：为什么我看不到停留点的地址？**
A：请确认 `reverse_geocode: true`；若使用高德，必须填入有效的 `amap_key`。

**Q：底图加载不出来 / 瓦片加载失败？**
A：CARTO 公共瓦片有访问频率限制。请在 `carto_key` 填入你自己的 CARTO Key。

**Q：轨迹不显示？**
A：请确认 `device_tracker` 实体在 `recorder` 中有历史记录。检查 `configuration.yaml` 是否排除了该实体：
```yaml
recorder:
  exclude:
    entities:
      - device_tracker.my_phone   # ← 不要排除它
```

**Q：能否显示多日的轨迹？**
A：当前版本每次只显示一天；用日期选择器切换日期即可。

**Q：Key 会泄露吗？**
A：不会写入代码仓库。Key 仅保存在你自己的仪表盘配置中，存在 HA 的 Lovelace 配置里，与你的其他 HA 数据一同存储。

## 🐛 故障排查

| 现象 | 可能原因 | 解决方案 |
|---|---|---|
| 卡片空白 / 控制台报错 `entities must be a non-empty list` | 未配置 `entities` | 至少配置一个 `device_tracker` 实体 |
| 高德逆编码返回 `INVALID_USER_KEY` | `amap_key` 错误或类型不符 | 确认 Key 类型为 **Web 服务** |
| 高德逆编码返回 `DAILY_QUERY_OVER_LIMIT` | Key 超出日配额 | 升级高德套餐或换用 BigDataCloud |
| 底图瓦片随机失败 / 被限流 | CARTO 公共配额 | 填入自己的 `carto_key` |
| 主题切换后底图不更新 | 浏览器缓存 | 强制刷新（Ctrl+F5） |
| 轨迹方向箭头消失 | `show_arrows: false` | 设为 `true` 或删除该行（默认开启） |

调试技巧：在浏览器开发者工具的 Console 中可看到 `[坐标转换失败]`、`[高德逆编码请求失败]` 等错误日志。

## 📝 更新日志

### v1.0.0
- 初始发布
- 移除代码内置的个人 AMap Key 与 CARTO Key
- 新增卡片配置项 `amap_key` 与 `carto_key`
- 仪表盘可视化编辑器增加 2 个 Key 输入框
- 修正高德 GPS(WGS84) → GCJ02 坐标分割顺序 BUG
- README 完整重写，文档与代码实际行为对齐

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。
