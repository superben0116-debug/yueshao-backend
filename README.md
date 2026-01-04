# DY Silicone Backend API

Express.js + SQLite 后端服务，为 DY Silicone 管理系统提供 API 支持。

## 功能特性

- ✅ 用户认证（登录、密码管理）
- ✅ 客户管理（增删改查）
- ✅ 收款记录管理（增删改查、核销、撤销）
- ✅ SQLite 数据库（无需额外配置）
- ✅ CORS 支持跨域请求

## API 端点

### 认证
- `POST /api/auth/login` - 用户登录
- `PUT /api/auth/account` - 更新账户信息

### 客户
- `GET /api/customers` - 获取所有客户
- `POST /api/customers` - 添加客户
- `PUT /api/customers/:id` - 更新客户

### 收款记录
- `GET /api/payments` - 获取所有收款记录
- `POST /api/payments` - 添加收款记录
- `PUT /api/payments/:id` - 更新收款记录
- `DELETE /api/payments/:id` - 删除收款记录
- `POST /api/payments/verify` - 核销收款记录
- `POST /api/payments/:id/undo-verification` - 撤销核销

## 本地开发

```bash
npm install
npm run dev
