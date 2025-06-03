const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5051;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Store connected devices
let connectedDevices = new Map();

// Device registration endpoint
app.post('/api/register-device', (req, res) => {
  const { deviceId, deviceName, ipAddress } = req.body;
  
  if (!deviceId || !deviceName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Device ID and name are required' 
    });
  }

  connectedDevices.set(deviceId, {
    deviceId,
    deviceName,
    ipAddress: req.ip,
    lastSeen: new Date(),
    status: 'online'
  });

  console.log(`Device registered: ${deviceName} (${deviceId})`);
  
  res.json({ 
    success: true, 
    message: 'Device registered successfully',
    deviceId 
  });
});

// Get connected devices
app.get('/api/devices', (req, res) => {
  const devices = Array.from(connectedDevices.values());
  res.json({ success: true, devices });
});

// Print text endpoint
app.post('/api/print/text', (req, res) => {
  const { deviceId, text, fontSize = 24, alignment = 'left' } = req.body;
  
  if (!deviceId || !text) {
    return res.status(400).json({ 
      success: false, 
      message: 'Device ID and text are required' 
    });
  }

  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ 
      success: false, 
      message: 'Device not found' 
    });
  }

  // Store print job for device to retrieve
  const printJob = {
    id: Date.now(),
    type: 'text',
    data: { text, fontSize, alignment },
    timestamp: new Date(),
    source: 'wifi'
  };

  // In a real implementation, you'd send this to the device
  // For now, we'll store it for the device to poll
  if (!device.printQueue) {
    device.printQueue = [];
  }
  device.printQueue.push(printJob);

  console.log(`Print job added for device ${deviceId}: ${text}`);
  
  res.json({ 
    success: true, 
    message: 'Print job queued successfully',
    jobId: printJob.id 
  });
});

// Print QR code endpoint
app.post('/api/print/qrcode', (req, res) => {
  const { deviceId, data, size = 200 } = req.body;
  
  if (!deviceId || !data) {
    return res.status(400).json({ 
      success: false, 
      message: 'Device ID and QR data are required' 
    });
  }

  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ 
      success: false, 
      message: 'Device not found' 
    });
  }

  const printJob = {
    id: Date.now(),
    type: 'qrcode',
    data: { data, size },
    timestamp: new Date(),
    source: 'wifi'
  };

  if (!device.printQueue) {
    device.printQueue = [];
  }
  device.printQueue.push(printJob);

  console.log(`QR print job added for device ${deviceId}: ${data}`);
  
  res.json({ 
    success: true, 
    message: 'QR print job queued successfully',
    jobId: printJob.id 
  });
});

// Print barcode endpoint
app.post('/api/print/barcode', (req, res) => {
  const { deviceId, data, type = 'CODE128', width = 2, height = 100 } = req.body;
  
  if (!deviceId || !data) {
    return res.status(400).json({ 
      success: false, 
      message: 'Device ID and barcode data are required' 
    });
  }

  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ 
      success: false, 
      message: 'Device not found' 
    });
  }

  const printJob = {
    id: Date.now(),
    type: 'barcode',
    data: { data, type, width, height },
    timestamp: new Date(),
    source: 'wifi'
  };

  if (!device.printQueue) {
    device.printQueue = [];
  }
  device.printQueue.push(printJob);

  console.log(`Barcode print job added for device ${deviceId}: ${data}`);
  
  res.json({ 
    success: true, 
    message: 'Barcode print job queued successfully',
    jobId: printJob.id 
  });
});

// Print image endpoint
app.post('/api/print/image', upload.single('image'), (req, res) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Device ID is required' 
    });
  }

  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: 'Image file is required' 
    });
  }

  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ 
      success: false, 
      message: 'Device not found' 
    });
  }

  const printJob = {
    id: Date.now(),
    type: 'image',
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    },
    timestamp: new Date(),
    source: 'wifi'
  };

  if (!device.printQueue) {
    device.printQueue = [];
  }
  device.printQueue.push(printJob);

  console.log(`Image print job added for device ${deviceId}: ${req.file.originalname}`);
  
  res.json({ 
    success: true, 
    message: 'Image print job queued successfully',
    jobId: printJob.id,
    filename: req.file.filename
  });
});

// Device polling endpoint to get print jobs
app.get('/api/print-jobs/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  
  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ 
      success: false, 
      message: 'Device not found' 
    });
  }
  
  const jobs = device.printQueue || [];
  console.log(jobs);
  device.printQueue = []; // Clear queue after sending
  device.lastSeen = new Date(); // Update last seen

  res.json({ 
    success: true, 
    jobs: jobs 
  });
});

// Serve uploaded images
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ success: false, message: 'File not found' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Print server is running',
    timestamp: new Date(),
    connectedDevices: connectedDevices.size
  });
});

// Device heartbeat endpoint
app.post('/api/heartbeat/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  
  const device = connectedDevices.get(deviceId);
  if (device) {
    device.lastSeen = new Date();
    device.status = 'online';
  }
  
  res.json({ success: true });
});

// Clean up offline devices periodically
setInterval(() => {
  const now = new Date();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  for (let [deviceId, device] of connectedDevices) {
    if (now - device.lastSeen > timeout) {
      device.status = 'offline';
      console.log(`Device ${device.deviceName} (${deviceId}) marked as offline`);
    }
  }
}, 60000); // Check every minute

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Print server running on port ${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT}`);
  console.log('API Endpoints:');
  console.log('  POST /api/register-device - Register a new device');
  console.log('  GET  /api/devices - Get connected devices');
  console.log('  POST /api/print/text - Print text');
  console.log('  POST /api/print/qrcode - Print QR code');
  console.log('  POST /api/print/barcode - Print barcode');
  console.log('  POST /api/print/image - Print image');
  console.log('  GET  /api/print-jobs/:deviceId - Get pending print jobs');
  console.log('  GET  /api/health - Health check');
});

module.exports = app;