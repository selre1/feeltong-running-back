
import MongoStore from "connect-mongo";
import RedisStore from "connect-redis";
import { mongoUrl } from "@/loadenv";

const getSessionStore = () => {
    return MongoStore.create({ mongoUrl });
  };

export default getSessionStore();