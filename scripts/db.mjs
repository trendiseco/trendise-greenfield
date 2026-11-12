import {poolFor,migrate,seed} from '../apps/api/src/database.mjs';
const pool=poolFor();try{if(process.argv[2]==='migrate')await migrate(pool);else if(process.argv[2]==='seed')await seed(pool);else throw new Error('Use migrate or seed');console.log('Database '+process.argv[2]+' complete (mock data only).');}finally{await pool.end();}
