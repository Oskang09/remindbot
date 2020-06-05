import { Client } from "https://deno.land/x/coward@v0.2.1/mod.ts";
import { moment } from "https://deno.land/x/moment/moment.ts";
import { serve } from "https://deno.land/std@0.50.0/http/server.ts";

type Reminder = {
  display: string,
  timeout: number,
  date: any,
  tasks: number[],
}

const serverURL: string = Deno.env.get("SERVER_URL")!!;
const secret: string = Deno.env.get("DISCORD_SECRET")!!;
const channelId: string = Deno.env.get("DISCORD_CHANNEL")!!;
const port: number = parseInt(Deno.env.get('PORT')!!);

const client = new Client(secret);
const headers = [
  " ----------- Reminder Usage -----------",
  "1. r! {hh:mm} {reminder display}      - add new reminder using expiry date hour & minutes",
  "2. r! {minutes} {reminder display}   - add new reminder using expiry in minutes",
  "3. r! clear                                                 - remove all current reminder",
  "4. r! remove {index}                             - remove reminder based on index",
  "5. r! show                                                    - to show reminder board",
];
let reminder: Reminder[] = [];

function displayTemplate() {
  const list: string[] = [
    ...headers,
    ` ----------- Reminder ( ${reminder.length} ) ----------- `,
  ];
  reminder.forEach(
    (remind, index) => {
      const end = remind.date.clone().add(remind.timeout, 'milliseconds');
      const duration = moment.duration(end.diff(moment())).asSeconds();
      let seconds = Math.ceil(duration % 60);
      let minutes = Math.ceil(duration / 60);
      if (seconds === 60) {
        seconds = 0
      } else {
        minutes -= 1
      }
      list.push(`${index + 1}.  (${end.format("HH:mm:sss")})  *${minutes}* minutes *${seconds === 60 ? 0 : seconds}* seconds    ${remind.display}`);
    },
  );
  client.postMessage(channelId, list.join('\n'));
}

client.evt.ready.attach(
  async () => {
    const list: string[] = [
      ...headers,
      " ----------- Reminder ( 0 ) ----------- ",
    ];
    const msg = await client.postMessage(channelId, list.join('\n'));
  }
);

client.evt.messageCreate.attach(async (args: any) => {
  const { message } = args;
  if (message.author.bot) return;
  if (message.channel.id !== channelId) return;
  if (message.content.startsWith("r! ")) {
    const [command, ...data] = message.content
      .substring(3, message.content.length)
      .split(" ");
    switch (command) {
      case "show":
        displayTemplate();
        break;
      case "remove":
        let index = parseInt(data[0]);
        if (index == NaN || index > reminder.length - 1) {
          break;
        }
        index -= 1;
        reminder[index].tasks.forEach(clearTimeout);
        reminder.splice(index, 1);
        displayTemplate();
        break;
      case "clear":
        reminder.forEach((remind) => remind.tasks.forEach(clearTimeout));
        reminder = [];
        displayTemplate();
        break;
      default:
        let timeout = 0;
        if (command.includes(":")) {
          const end = moment(command, "HH:mm");
          timeout = moment.duration(end.diff(moment())).asMinutes()
        } else {
          timeout = parseInt(command);
        }

        if (timeout == NaN || timeout == 0) {
          return
        }

        if (timeout <= 1) {
          return client.postMessage(message.channel.id, "ERROR: remind time must be over 1, value is count based on minutes.");
        }

        let remind: Reminder = {
          display: data.join(" "),
          timeout: timeout * 60 * 1000,
          date: moment(),
          tasks: [],
        };

        const reminderIndex = reminder.push(remind);
        remind.tasks.push(
          setTimeout(
            () => {
              client.postMessage(channelId, `REMIND: @here, its time to ` + remind.display);
              reminder.splice(reminderIndex - 1, 1);
            },
            remind.timeout,
          ),
        );
        remind.tasks.push(
          setTimeout(() => client.postMessage(channelId, `REMIND: @here, 1 minutes more to ` + remind.display), remind.timeout - 60000),
        );
        if (remind.timeout > 60000 * 5) {
          remind.tasks.push(
            setTimeout(() => client.postMessage(channelId, `REMIND: @here, 5 minutes more to ` + remind.display), remind.timeout - (60000 * 5)),
          );
        }
        if (remind.timeout > 60000 * 10) {
          remind.tasks.push(
            setTimeout(() => client.postMessage(channelId, `REMIND: @here, 10 minutes more to ` + remind.display), remind.timeout - (60000 * 10)),
          );
        }
        displayTemplate();
        break;
    }
  }
});

client.connect();

/* Repeating calling to prevent idling */
setInterval(async () => await fetch(serverURL), 28 * 60 * 1000);

/* HTTP Server */
const server = serve({ port });
for await (const req of server) {
  req.respond({ body: "OK" });
}