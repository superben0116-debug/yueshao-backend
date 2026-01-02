# Yueshao Backend

Node.js + Express + SQLite 后端服务

## 功能
- 题库数据持久化存储
- 跨浏览器数据同步
- RESTful API 接口

## API 端点
- `GET /health` - 健康检查
- `GET /getBank` - 获取所有题库
- `POST /saveBank` - 保存题库数据
- `DELETE /deleteBank/:id` - 删除单条题库

## 本地运行
```bash
npm install
npm start
