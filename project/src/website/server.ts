import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const server = http.createServer((req, res) => {
  let filePath = path.join(
    __dirname,
    '..',
    '..',
    req.url! === '/' ? 'src/website/index.html' : req.url!
  );
  console.log('filePath', filePath);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(data);
  });
});

const getContentType = (filePath: string): string => {
  switch (path.extname(filePath)) {
    case '.html':
      return 'text/html';
    case '.js':
      return 'text/javascript';
    default:
      return 'text/plain';
  }
};

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
