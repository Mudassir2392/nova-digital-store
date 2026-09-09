
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(__dirname,'..');
const uploadsDir=path.join(root,'uploads');
const databaseDir=path.join(root,'database');
fs.mkdirSync(uploadsDir,{recursive:true});
fs.mkdirSync(databaseDir,{recursive:true});

const app=express();
const db=new Database(path.join(databaseDir,'nova.sqlite'));
const PORT=process.env.PORT||3000;
const SECRET=process.env.JWT_SECRET||'CHANGE_THIS_SECRET_BEFORE_DEPLOYING';
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'mudassir239200@gmail.com';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'Nova@12345';
const FREE_DELIVERY_MIN=1500;
const STANDARD_DELIVERY_FEE=250;

app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use('/assets',express.static(path.join(root,'assets')));
app.use('/uploads',express.static(uploadsDir));
app.use('/admin',express.static(path.join(root,'admin')));
app.use(express.static(path.join(root,'frontend')));

const storage=multer.diskStorage({
  destination:(_r,_f,cb)=>cb(null,uploadsDir),
  filename:(_r,f,cb)=>cb(null,`product-${Date.now()}-${Math.round(Math.random()*1e6)}${path.extname(f.originalname).toLowerCase()||'.jpg'}`)
});
const upload=multer({storage,limits:{fileSize:7*1024*1024},fileFilter:(_r,f,cb)=>f.mimetype.startsWith('image/')?cb(null,true):cb(new Error('Only image files are allowed'))});

db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL,compare_price INTEGER NOT NULL DEFAULT 0,stock INTEGER NOT NULL DEFAULT 0,image TEXT,description TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_name TEXT NOT NULL,customer_email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL,address TEXT NOT NULL,city TEXT NOT NULL DEFAULT '',province TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',subtotal INTEGER NOT NULL DEFAULT 0,delivery_fee INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',courier TEXT NOT NULL DEFAULT '',tracking_no TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,quantity INTEGER NOT NULL,price INTEGER NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(product_id) REFERENCES products(id));
`);
for(const col of [
  'compare_price INTEGER NOT NULL DEFAULT 0',
]){try{db.exec(`ALTER TABLE products ADD COLUMN ${col}`)}catch{}}
for(const col of [
  "customer_email TEXT NOT NULL DEFAULT ''",'subtotal INTEGER NOT NULL DEFAULT 0','delivery_fee INTEGER NOT NULL DEFAULT 0',
  "city TEXT NOT NULL DEFAULT ''","province TEXT NOT NULL DEFAULT ''","notes TEXT NOT NULL DEFAULT ''",
  "courier TEXT NOT NULL DEFAULT ''","tracking_no TEXT NOT NULL DEFAULT ''"
]){try{db.exec(`ALTER TABLE orders ADD COLUMN ${col}`)}catch{}}

// Ensure the requested NOVA DIGITAL admin account always exists.
if(!db.prepare('SELECT id FROM admins WHERE email=?').get(ADMIN_EMAIL)){
  db.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').run(ADMIN_EMAIL,bcrypt.hashSync(ADMIN_PASSWORD,12));
}
if(!db.prepare('SELECT id FROM products LIMIT 1').get()){
  const q=db.prepare('INSERT INTO products(name,category,price,compare_price,stock,image,description) VALUES(?,?,?,?,?,?,?)');
  [
    ['Wireless Gaming Headset','Gaming',2499,2999,20,'','Deep sound, comfortable fit and gaming-ready design.'],
    ['Premium Tracksuit','Tracksuits',3999,4599,15,'','Premium comfort for casual wear and training.'],
    ['Running Shoes','Shoes',3299,3899,18,'','Lightweight everyday sports shoes.'],
    ['Wireless Earbuds','Electronics',1999,2499,25,'','Compact Bluetooth earbuds for daily use.'],
    ['Cargo Trousers','Trousers',2299,2699,12,'','Modern casual cargo trousers with a clean fit.']
  ].forEach(x=>q.run(...x));
}

const auth=(req,res,next)=>{try{req.admin=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),SECRET);next()}catch{res.status(401).json({error:'Unauthorized'})}};
const categories=['Shoes','Tracksuits','Trousers','Electronics','Gaming','Accessories','Other'];

app.get('/api/store-info',(_r,res)=>res.json({name:'NOVA DIGITAL',phone:'03499345762',email:'mudassir239200@gmail.com',country:'Pakistan',support:'24/7',free_delivery_min:FREE_DELIVERY_MIN,standard_delivery_fee:STANDARD_DELIVERY_FEE,courier_connected:false}));
app.get('/api/products',(_r,res)=>res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all()));
app.get('/api/products/:id',(req,res)=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);p?res.json(p):res.status(404).json({error:'Not found'})});

app.post('/api/orders',(req,res)=>{
  const {customer_name,customer_email='',phone,address,city='',province='',notes='',items}=req.body;
  if(!customer_name?.trim()||!customer_email?.trim()||!/^\S+@\S+\.\S+$/.test(customer_email.trim())||!phone?.trim()||!address?.trim()||!Array.isArray(items)||!items.length)return res.status(400).json({error:'Complete name, email, phone, address and cart details required'});
  const get=db.prepare('SELECT * FROM products WHERE id=?');let subtotal=0;const valid=[];
  for(const i of items){const p=get.get(Number(i.product_id)),q=Number(i.quantity);if(!p||!Number.isInteger(q)||q<1||q>p.stock)return res.status(400).json({error:'Product stock changed. Please refresh cart.'});subtotal+=p.price*q;valid.push({p,q})}
  const delivery=subtotal>=FREE_DELIVERY_MIN?0:STANDARD_DELIVERY_FEE,total=subtotal+delivery;
  const create=db.transaction(()=>{const o=db.prepare('INSERT INTO orders(customer_name,customer_email,phone,address,city,province,notes,subtotal,delivery_fee,total) VALUES(?,?,?,?,?,?,?,?,?,?)').run(customer_name.trim(),customer_email.trim().toLowerCase(),phone.trim(),address.trim(),city.trim(),province.trim(),notes.trim(),subtotal,delivery,total);for(const x of valid){db.prepare('INSERT INTO order_items(order_id,product_id,quantity,price) VALUES(?,?,?,?)').run(o.lastInsertRowid,x.p.id,x.q,x.p.price);db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(x.q,x.p.id)}return Number(o.lastInsertRowid)});
  res.status(201).json({order_id:create(),subtotal,delivery_fee:delivery,total});
});
app.get('/api/orders/:id/track',(req,res)=>{const o=db.prepare('SELECT id,phone,total,status,courier,tracking_no,created_at FROM orders WHERE id=?').get(req.params.id);if(!o||String(o.phone).replace(/\D/g,'')!==String(req.query.phone||'').replace(/\D/g,''))return res.status(404).json({error:'Order not found. Check order number and phone.'});res.json(o)});

app.post('/api/admin/login',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase();const a=db.prepare('SELECT * FROM admins WHERE lower(email)=?').get(email);if(!a||!bcrypt.compareSync(req.body.password||'',a.password_hash))return res.status(401).json({error:'Invalid email or password'});res.json({token:jwt.sign({id:a.id,email:a.email},SECRET,{expiresIn:'8h'}),email:a.email})});
app.post('/api/admin/change-password',auth,(req,res)=>{const password=String(req.body.password||'');if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password,12),req.admin.id);res.json({ok:true})});
app.get('/api/admin/orders',auth,(_r,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC').all()));
app.get('/api/admin/order-items/:id',auth,(req,res)=>res.json(db.prepare('SELECT oi.*,p.name,p.image FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?').all(req.params.id)));
app.get('/api/admin/stats',auth,(_r,res)=>res.json({products:db.prepare('SELECT COUNT(*) c FROM products').get().c,orders:db.prepare('SELECT COUNT(*) c FROM orders').get().c,revenue:db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status='Delivered'").get().s,pending:db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('Pending','Confirmed')").get().c}));

app.post('/api/admin/products',auth,upload.single('image'),(req,res)=>{const {name,category,price,compare_price=0,stock,description='',image_url=''}=req.body;const np=Number(price),cp=Number(compare_price||0),ns=Number(stock);if(!name?.trim()||!categories.includes(category)||!Number.isFinite(np)||np<0||!Number.isFinite(cp)||cp<0||!Number.isInteger(ns)||ns<0)return res.status(400).json({error:'Please enter valid product details'});const image=req.file?`/uploads/${req.file.filename}`:(image_url||'').trim();const r=db.prepare('INSERT INTO products(name,category,price,compare_price,stock,image,description) VALUES(?,?,?,?,?,?,?)').run(name.trim(),category,np,cp,ns,image,description.trim());res.status(201).json({id:Number(r.lastInsertRowid)})});
app.patch('/api/admin/products/:id',auth,(req,res)=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);if(!p)return res.status(404).json({error:'Product not found'});const name=String(req.body.name??p.name).trim();const category=req.body.category??p.category;const price=Number(req.body.price??p.price),compare_price=Number(req.body.compare_price??p.compare_price??0),stock=Number(req.body.stock??p.stock),description=req.body.description??p.description,image=req.body.image??p.image;if(!name||!categories.includes(category)||!Number.isFinite(price)||price<0||!Number.isFinite(compare_price)||compare_price<0||!Number.isInteger(stock)||stock<0)return res.status(400).json({error:'Invalid product data'});db.prepare('UPDATE products SET name=?,category=?,price=?,compare_price=?,stock=?,image=?,description=? WHERE id=?').run(name,category,price,compare_price,stock,image,description,req.params.id);res.json({ok:true})});
app.patch('/api/admin/orders/:id',auth,(req,res)=>{const allowed=['Pending','Confirmed','Ready to Ship','Shipped','Delivered','Cancelled'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status'});db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status,req.params.id);res.json({ok:true})});
app.patch('/api/admin/orders/:id/tracking',auth,(req,res)=>{const courier=String(req.body.courier||'').trim(),tracking=String(req.body.tracking_no||'').trim();db.prepare('UPDATE orders SET courier=?,tracking_no=?,status=CASE WHEN ?<>\'\' THEN \'Shipped\' ELSE status END WHERE id=?').run(courier,tracking,tracking,req.params.id);res.json({ok:true})});
app.post('/api/admin/orders/:id/create-shipment',auth,(_req,res)=>res.status(501).json({error:'Courier API is not connected yet. Add your courier account/API credentials first.'}));
app.delete('/api/admin/products/:id',auth,(req,res)=>{const p=db.prepare('SELECT image FROM products WHERE id=?').get(req.params.id);try{db.prepare('DELETE FROM products WHERE id=?').run(req.params.id)}catch{return res.status(409).json({error:'This product is used in an order and cannot be deleted. Set stock to 0 instead.'})}if(p?.image?.startsWith('/uploads/'))try{fs.unlinkSync(path.join(root,p.image))}catch{}res.json({ok:true})});

app.get('/admin/',(_r,res)=>res.sendFile(path.join(root,'admin/index.html')));
app.get('*',(_r,res)=>res.sendFile(path.join(root,'frontend/index.html')));
app.use((err,_r,res,_n)=>res.status(400).json({error:err.message||'Request failed'}));
app.listen(PORT,()=>{console.log(`\nNOVA DIGITAL: http://localhost:${PORT}`);console.log(`ADMIN: http://localhost:${PORT}/admin/`);console.log(`Admin email: ${ADMIN_EMAIL}`);console.log('If login fails, run: npm run reset-admin\n')});
