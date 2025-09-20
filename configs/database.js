import mongo from 'mongoose'
import 'dotenv/config'

const connectDB = async ()=>{
    try {
        await mongo.connect(process.env.MONGO_URI)
        console.log('DB connect ');
        
    } catch (error) {
        console.log('Error to connect '+error);
        process.exit(1);
        
    }
}


export default connectDB