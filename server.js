import express from 'express';  
import cors from 'cors';  
import bodyParser from 'body-parser';  
import pkg from 'pg';  
import { fileURLToPath } from 'url';  
import { dirname } from 'path';  
const { Pool } = pkg;  
const __filename = fileURLToPath(import.meta.url);  
const __dirname = dirname(__filename);  
const app = express();  
const PORT = process.env.PORT || 8080;  
// 中间件  
app.use(cors());  
app.use(bodyParser.json({ limit: '50mb' }));  
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));  
// PostgreSQL 连接池配置  
const pool = new Pool({  
  user: process.env.POSTGRES_USER,  
  password: process.env.POSTGRES_PASSWORD,  
  host: process.env.POSTGRES_HOST,  
  port: parseInt(process.env.POSTGRES_PORT || '5432'),  
  database: process.env.POSTGRES_DB,  
  // 添加连接超时和重试配置  
  connectionTimeoutMillis: 5000,  
  idleTimeoutMillis: 30000,  
  max: 20,  
});  
// 初始化数据库表  
async function initializeDatabase() {  
  try {  
    await pool.query(`  
      CREATE TABLE IF NOT EXISTS quiz_banks (  
        id TEXT PRIMARY KEY,  
        fileName TEXT NOT NULL,  
        timestamp INTEGER NOT NULL,  
        difficulty TEXT NOT NULL,  
        questions JSONB NOT NULL,  
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP  
      )  
    `);  
    console.log('✓ PostgreSQL 数据库表已初始化');  
  } catch (err) {  
    console.error('创建表失败:', err);  
  }  
}  
// 连接池事件处理  
pool.on('error', (err) => {  
  console.error('数据库连接池错误:', err);  
});  
pool.on('connect', () => {  
  console.log('✓ PostgreSQL 数据库已连接');  
});  
// 测试数据库连接  
async function testDatabaseConnection() {  
  try {  
    const result = await pool.query('SELECT NOW()');  
    console.log('✓ 数据库连接测试成功:', result.rows[0]);  
  } catch (err) {  
    console.error('✗ 数据库连接测试失败:', err.message);  
    console.error('连接配置:', {  
      user: process.env.POSTGRES_USER,  
      host: process.env.POSTGRES_HOST,  
      port: process.env.POSTGRES_PORT,  
      database: process.env.POSTGRES_DB,  
    });  
  }  
}  
// 初始化数据库  
testDatabaseConnection();  
initializeDatabase();  
// 健康检查  
app.get('/health', (req, res) => {  
  res.json({ status: 'ok', message: '后端服务运行正常' });  
});  
// 获取所有题库  
app.get('/getBank', async (req, res) => {  
  try {  
    const result = await pool.query(  
      'SELECT * FROM quiz_banks ORDER BY timestamp DESC'  
    );  
      
    const data = result.rows.map(row => ({  
      ...row,  
      questions: typeof row.questions === 'string'   
        ? JSON.parse(row.questions)   
        : row.questions  
    }));  
      
    res.json({ success: true, data });  
  } catch (err) {  
    console.error('查询失败:', err);  
    res.status(500).json({ success: false, error: err.message });  
  }  
});  
// 保存题库  
app.post('/saveBank', async (req, res) => {  
  const { data } = req.body;  
    
  if (!Array.isArray(data)) {  
    return res.status(400).json({ success: false, error: '数据格式错误' });  
  }  
  const client = await pool.connect();  
  try {  
    await client.query('BEGIN');  
      
    // 清空现有数据  
    await client.query('DELETE FROM quiz_banks');  
    // 插入新数据  
    for (const record of data) {  
      const { id, fileName, timestamp, difficulty, questions } = record;  
        
      await client.query(  
        `INSERT INTO quiz_banks (id, fileName, timestamp, difficulty, questions)  
         VALUES ($1, $2, $3, $4, $5)`,  
        [id, fileName, timestamp, difficulty, JSON.stringify(questions)]  
      );  
    }  
    await client.query('COMMIT');  
    console.log(`✓ 已保存 ${data.length} 条题库记录`);  
    res.json({ success: true, message: `已保存 ${data.length} 条记录` });  
  } catch (err) {  
    await client.query('ROLLBACK');  
    console.error('保存失败:', err);  
    res.status(500).json({ success: false, error: err.message });  
  } finally {  
    client.release();  
  }  
});  
// 删除单条题库  
app.delete('/deleteBank/:id', async (req, res) => {  
  const { id } = req.params;  
    
  try {  
    const result = await pool.query(  
      'DELETE FROM quiz_banks WHERE id = $1',  
      [id]  
    );  
      
    if (result.rowCount === 0) {  
      return res.status(404).json({ success: false, error: '题库不存在' });  
    }  
      
    console.log(`✓ 已删除题库: ${id}`);  
    res.json({ success: true, message: '题库已删除' });  
  } catch (err) {  
    console.error('删除失败:', err);  
    res.status(500).json({ success: false, error: err.message });  
  }  
});  
// 启动服务器  
app.listen(PORT, () => {  
  console.log(`\n🚀 后端服务已启动`);  
  console.log(`📍 服务地址: http://localhost:${PORT}`);  
  console.log(`✓ API 端点:`);  
  console.log(`  - GET  /health       - 健康检查`);  
  console.log(`  - GET  /getBank      - 获取所有题库`);  
  console.log(`  - POST /saveBank     - 保存题库`);  
  console.log(`  - DELETE /deleteBank/:id - 删除题库\n`);  
});  
// 优雅关闭  
process.on('SIGINT', async () => {  
  console.log('\n正在关闭数据库连接...');  
  await pool.end();  
  console.log('✓ 数据库已关闭');  
  process.exit(0);  
});  
