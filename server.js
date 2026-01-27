import express from 'express';  
import cors from 'cors';  
import bodyParser from 'body-parser';  
import pkg from 'pg';  
import { WebSocketServer } from 'ws';  
import { createServer } from 'http';  
const { Pool } = pkg;  
// 初始化数据库连接池  
const pool = new Pool({  
  connectionString: process.env.DATABASE_URL,  
});  
const app = express();  
const server = createServer(app);  
const wss = new WebSocketServer({ server });  
// 中间件  
app.use(cors());  
app.use(bodyParser.json());  
// 存储所有连接的客户端  
const clients = new Set();  
// WebSocket 连接处理  
wss.on('connection', (ws) => {  
  clients.add(ws);  
  console.log('✓ 客户端已连接，当前连接数:', clients.size);  
    
  ws.on('close', () => {  
    clients.delete(ws);  
    console.log('✓ 客户端已断开，当前连接数:', clients.size);  
  });  
});  
// 广播数据更新给所有客户端  
function broadcastUpdate(type, data) {  
  const message = JSON.stringify({ type, data, timestamp: Date.now() });  
  clients.forEach(client => {  
    if (client.readyState === 1) { // 1 = OPEN  
      client.send(message);  
    }  
  });  
}  
// 初始化数据库表  
async function initializeDatabase() {  
  try {  
    await pool.query(`  
      CREATE TABLE IF NOT EXISTS quiz_banks (  
        id VARCHAR(255) PRIMARY KEY,  
        fileName VARCHAR(255) NOT NULL,  
        timestamp BIGINT NOT NULL,  
        difficulty VARCHAR(50) NOT NULL,  
        questions JSONB NOT NULL,  
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  
      )  
    `);  
    console.log('✓ 数据库表已初始化');  
  } catch (err) {  
    console.error('✗ 数据库初始化失败:', err);  
  }  
}  
// 获取所有题库  
app.get('/api/banks', async (req, res) => {  
  try {  
    const result = await pool.query('SELECT * FROM quiz_banks ORDER BY created_at DESC');  
    res.json({ success: true, data: result.rows });  
  } catch (err) {  
    res.status(500).json({ success: false, error: err.message });  
  }  
});  
// 获取特定难度的题库  
app.get('/api/banks/:difficulty', async (req, res) => {  
  try {  
    const { difficulty } = req.params;  
    const result = await pool.query(  
      'SELECT * FROM quiz_banks WHERE difficulty = $1 ORDER BY created_at DESC',  
      [difficulty]  
    );  
    res.json({ success: true, data: result.rows });  
  } catch (err) {  
    res.status(500).json({ success: false, error: err.message });  
  }  
});  
// 保存题库  
app.post('/api/banks', async (req, res) => {  
  const { data } = req.body;  
    
  if (!Array.isArray(data)) {  
    return res.status(400).json({ success: false, error: '数据格式错误' });  
  }  
    
  const client = await pool.connect();  
  try {  
    await client.query('BEGIN');  
      
    for (const record of data) {  
      const { id, fileName, timestamp, difficulty, questions } = record;  
      await client.query(  
        `INSERT INTO quiz_banks (id, fileName, timestamp, difficulty, questions)  
         VALUES ($1, $2, $3, $4, $5)  
         ON CONFLICT (id) DO UPDATE SET  
         fileName = $2, timestamp = $3, difficulty = $4, questions = $5`,  
        [id, fileName, timestamp, difficulty, JSON.stringify(questions)]  
      );  
    }  
      
    await client.query('COMMIT');  
      
    // 广播更新给所有连接的客户端  
    broadcastUpdate('dataUpdated', { count: data.length });  
      
    res.json({ success: true, message: `已保存 ${data.length} 条记录` });  
  } catch (err) {  
    await client.query('ROLLBACK');  
    res.status(500).json({ success: false, error: err.message });  
  } finally {  
    client.release();  
  }  
});  
// 删除题库  
app.delete('/api/banks/:id', async (req, res) => {  
  try {  
    const { id } = req.params;  
    await pool.query('DELETE FROM quiz_banks WHERE id = $1', [id]);  
    broadcastUpdate('dataDeleted', { id });  
    res.json({ success: true, message: '已删除' });  
  } catch (err) {  
    res.status(500).json({ success: false, error: err.message });  
  }  
});  
// 健康检查  
app.get('/health', (req, res) => {  
  res.json({ status: 'ok' });  
});  
const PORT = process.env.PORT || 8080;  
// 启动服务器  
async function start() {  
  await initializeDatabase();  
  server.listen(PORT, () => {  
    console.log(`🚀 后端服务已启动 (端口: ${PORT}, WebSocket 已启用)`);  
  });  
}  
start().catch(err => {  
  console.error('启动失败:', err);  
  process.exit(1);  
});  
