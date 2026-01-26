import express from 'express';  
import cors from 'cors';  
import bodyParser from 'body-parser';  
import pkg from 'pg';  
import { WebSocketServer } from 'ws';  
import { createServer } from 'http';  
const { Pool } = pkg;  
const app = express();  
const server = createServer(app);  
const wss = new WebSocketServer({ server });  
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
// 修改 saveBank 端点  
app.post('/saveBank', async (req, res) => {  
  const { data } = req.body;  
    
  if (!Array.isArray(data)) {  
    return res.status(400).json({ success: false, error: '数据格式错误' });  
  }  
    
  const client = await pool.connect();  
  try {  
    await client.query('BEGIN');  
    await client.query('DELETE FROM quiz_banks');  
      
    for (const record of data) {  
      const { id, fileName, timestamp, difficulty, questions } = record;  
      await client.query(  
        `INSERT INTO quiz_banks (id, fileName, timestamp, difficulty, questions)  
         VALUES ($1, $2, $3, $4, $5)`,  
        [id, fileName, timestamp, difficulty, JSON.stringify(questions)]  
      );  
    }  
      
    await client.query('COMMIT');  
      
    // 🔑 关键：广播更新给所有连接的客户端  
    broadcastUpdate('dataUpdated', { count: data.length });  
      
    res.json({ success: true, message: `已保存 ${data.length} 条记录` });  
  } catch (err) {  
    await client.query('ROLLBACK');  
    res.status(500).json({ success: false, error: err.message });  
  } finally {  
    client.release();  
  }  
});  
// 启动服务器  
server.listen(PORT, () => {  
  console.log(`🚀 后端服务已启动 (WebSocket 已启用)`);  
});  
