import UsersService from './src/services/UsersService';

const run = async () => {
    try {
        const srv = new UsersService();
        const users = await srv.getAll();
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
};

run();
