import http from 'http';

http.get(
  'http://127.0.0.1:5173/api/em/api/qt/ulist.np/get?fltt=2&fields=f2,f12,f14&secids=1.000001',
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => console.log(res.statusCode, body.slice(0, 200)));
  }
).on('error', console.error);
