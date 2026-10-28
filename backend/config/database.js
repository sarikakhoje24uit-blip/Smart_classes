import mongoose from 'mongoose';
import dns from 'dns';

// Fix querySrv ECONNREFUSED on local Wi-Fi / ISPs
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kashvi_smartclass');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️ Server will continue. Start MongoDB service for persistence (e.g. mongod or Docker).');
  }
};

export default connectDB;
