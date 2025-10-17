import { CommandContext } from "grammy";
import type { MyContext } from "../types";

export async function handleNewsletter(ctx: CommandContext<MyContext>) {
  if (!ctx.session.isAdmin) {
    return ctx.reply("❌ Эта команда доступна только администраторам.");
  }
  return ctx.conversation.enter("newsletter");
}
