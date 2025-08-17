import { isUserHasId } from "grammy-guard";
import { config } from "../utils/config";

export const isBotAdmin = isUserHasId(...config.adminUserIds);
