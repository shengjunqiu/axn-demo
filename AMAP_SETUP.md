# 高德地图路线配置

项目使用高德 JS API 2.0 的地图与 `AMap.Driving` 驾车规划，无需另填 Web 服务 API Key。

1. 在高德开放平台创建应用，添加服务平台为 **Web端（JS API）** 的 Key，启用对应地图、驾车路线服务，并配置部署域名。
2. 填写项目根目录 `.env.local`：`VITE_AMAP_KEY` 和配套的 `VITE_AMAP_SECURITY_CODE`。文件已创建，且被 Git 忽略；可提交的模板为 `.env.example`。
3. 重启 `pnpm dev`。确认地图展示线路后，里程、预计耗时与行驶指引均来自高德返回结果。

默认路线：成都东站 → 都江堰市人民政府。可修改 `VITE_AMAP_ROUTE_ORIGIN`、`VITE_AMAP_ROUTE_DESTINATION`、`VITE_AMAP_ROUTE_CITY`。这些是公开地点的演示路线，与页面中模拟灾情的地理位置不作绑定。当前为普通驾车规划，不能作为重型工程车辆限高、限重的通行许可。

生产环境建议配置 `VITE_AMAP_SERVICE_HOST`，把安全密钥留在服务器代理中；配置该项后不使用浏览器明文安全码。`VITE_` 变量会进入前端构建，不能把服务端私钥填入其中。

地图未配置或请求失败时展示配置/重试提示，不回退到虚构线路；规划失败保留真实底图。当前没有凭据，尚未做真实接口联调。

官方文档：
- https://developer.amap.com/api/javascript-api-v2/tutorails/car-dir
- https://developer.amap.com/api/javascript-api-v2/guide/abc/jscode

## 多路线备选

地图同时按时间优先、少收费、距离优先三种策略请求驾车规划，在方案卡片中展示高德返回的里程与预计耗时。点击方案会同步切换地图线路和行驶指引。相同几何路径会合并标签，不人为制造三条路线；部分策略失败时仍展示已返回的有效方案。一次打开地图会产生三次路线规划请求，计入高德服务配额，无需新增 Key。
