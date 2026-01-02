import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// 确保 data 目录存在
const dataDir = join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化 SQLite 数据库
const db = new sqlite3.Database(join(dataDir, 'quiz.db'), (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('✓ SQLite 数据库已连接');
    initializeDatabase();
  }
});

// 初始化数据库表
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_banks (
      id TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      questions TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('创建表失败:', err);
    } else {
      console.log('✓ 数据库表已初始化');
    }
  });
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '后端服务运行正常' });
});

// 获取所有题库
app.get('/getBank', (req, res) => {
  db.all('SELECT * FROM quiz_banks ORDER BY timestamp DESC', (err, rows) => {
    if (err) {
      console.error('查询失败:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    // 将 JSON 字符串转换回对象
    const data = rows.map(row => ({
      ...row,
      questions: JSON.parse(row.questions)
    }));
    
    res.json({ success: true, data });
  });
});

// 保存题库
app.post('/saveBank', (req, res) => {
  const { data } = req.body;
  
  if (!Array.isArray(data)) {
    return res.status(400).json({ success: false, error: '数据格式错误' });
  }

  // 清空现有数据并插入新数据
  db.serialize(() => {
    db.run('DELETE FROM quiz_banks', (err) => {
      if (err) {
        console.error('清空表失败:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      let completed = 0;
      let hasError = false;

      data.forEach((record) => {
        const { id, fileName, timestamp, difficulty, questions } = record;
        
        db.run(
          `INSERT INTO quiz_banks (id, fileName, timestamp, difficulty, questions)
           VALUES (?, ?, ?, ?, ?)`,
          [id, fileName, timestamp, difficulty, JSON.stringify(questions)],
          (err) => {
            completed++;
            if (err) {
              console.error('插入失败:', err);
              hasError = true;
            }

            // 所有记录处理完成
            if (completed === data.length) {
              if (hasError) {
                res.status(500).json({ success: false, error: '部分数据保存失败' });
              } else {
                console.log(`✓ 已保存 ${data.length} 条题库记录`);
                res.json({ success: true, message: `已保存 ${data.length} 条记录` });
              }
            }
          }
        );
      });
    });
  });
});

// 删除单条题库
app.delete('/deleteBank/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM quiz_banks WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('删除失败:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    console.log(`✓ 已删除题库: ${id}`);
    res.json({ success: true, message: '题库已删除' });
  });
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
process.on('SIGINT', () => {
  console.log('\n正在关闭数据库连接...');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库失败:', err);
    } else {
      console.log('✓ 数据库已关闭');
    }
    process.exit(0);
  });
});
