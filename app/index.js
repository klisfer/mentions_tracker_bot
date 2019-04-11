const dotenv = require("dotenv");
const Bot = require("@dlghq/dialog-bot-sdk");
const {
  MessageAttachment,
  ActionGroup,
  Action,
  Button,
  Select,
  SelectOption
} = require("@dlghq/dialog-bot-sdk");
const { flatMap } = require("rxjs/operators");
const axios = require("axios");
const { merge } = require("rxjs");
const moment = require("moment");
var _ = require("lodash");

dotenv.config();

var mentions = [];
var addedToGroups = [];
var groupsToTrack = [];
const currentUser = { id: "", name: "" };

async function run(token, endpoint) {
  const bot = new Bot.default({
    token,
    endpoints: [endpoint]
  });

  //fetching bot name
  const self = await bot.getSelf();
  console.log(`I've started, post me something @${self.nick}`);

  bot.updateSubject.subscribe({
    next(update) {
      console.log(JSON.stringify({ update }, null, 2));
    }
  });

  //subscribing to incoming messages
  const messagesHandle = bot.subscribeToMessages().pipe(
    flatMap(async message => {
      console.log("MESSAGE", message);
      const wordsArray = message.content.text.split(" ");
      const user_current = "@" + currentUser.name;

      //conditions to check for user mentions.
      if (
        message.peer.type === "private" &&
        message.peer.type === "private" &&
        message.content.text === "start tracking"
      ) {
        console.log("userId", message.peer.id);
        const user = await bot.getUser(message.peer.id);

        currentUser.id = user.id;
        currentUser.name = user.name;
        console.log("user", currentUser); // user
      } else if (
        message.peer.type === "group" &&
        message.content.text === "User invited to the group"
      ) {
        const groupAdded = await bot.getGroup(message.peer.id);
        console.log("group added", groupAdded);
        const newGroup = { id: groupAdded.id, name: groupAdded.title };
        addedToGroups.push(newGroup);
        groupsToTrack.push.apply(groupsToTrack, addedToGroups);
        console.log("groups to track", addedToGroups);
        console.log("groupsToTrack", groupsToTrack);
      } else if (
        _.includes(wordsArray, user_current) &&
        message.content.type === "text" &&
        message.peer.type === "group" &&
        containsValue(groupsToTrack, message.peer.id) === true
      ) {
        // messages = await bot.fetchMessages([message.id]);
        // console.log("message details", messages);

        const mention = `${message.date} : ${message.content.text} \n`;
        mentions.push(mention);
      } else if (
        message.content.type === "text" &&
        message.peer.type === "private" &&
        message.content.text === "stop tracking"
      ) {
        groupsToTrack = [];
        console.log("groupsToTrack", groupsToTrack);
      } else if (
        message.content.type === "text" &&
        message.peer.type === "private" &&
        message.content.text === "schedule"
      ) {
        const options = [
          {
            label: "Evening",
            value: "Evening"
          }
        ];
        var selectOptions = [];

        selectOptions.push(
          SelectOption.create({
            label: "Morning",
            value: "Morning"
          })
        );
        selectOptions.push(new SelectOption("Afternoon", "Afternoon"));
        selectOptions.push(new SelectOption("Evening", "Evening"));
        console.log("selectOptions2", selectOptions);

        const mid = await bot.sendText(
          message.peer,
          "When do you want to schedule the mentions",
          MessageAttachment.reply(null),
          ActionGroup.create({
            actions: [
              Action.create({
                id: `30mins`,
                widget: Select.create({
                  label: "options",
                  options: selectOptions
                })
              })
            ]
          })
        );
      } else if (
        message.content.type === "text" &&
        message.peer.type === "private" &&
        message.content.text === "mentions"
      ) {
        const ment = bot.sendText(
          message.peer,
          mentions,
          MessageAttachment.reply(message.id)
        );
        ment.then(function(result) {
          console.log("abcd", result);
        });
        console.log("MENTIONS", mentions);
      } else if (
        message.content.type === "text" &&
        message.peer.type === "private" &&
        message.content.text === "subscriptions"
      ) {
        console.log("entered here");
        _.forEach(addedToGroups, async function(group) {
          const buttonText = containsValue(groupsToTrack, group.id)
            ? "Stop"
            : "Start";
          const mid = await bot.sendText(
            message.peer,
            group.name,
            MessageAttachment.reply(null),
            ActionGroup.create({
              actions: [
                Action.create({
                  id: `${group.id}`,
                  widget: Button.create({ label: buttonText })
                })
              ]
            })
          );
        });
      }
    })
  );

  //creating action handle
  const actionsHandle = bot.subscribeToActions().pipe(
    flatMap(async event => {
      if (containsValue(groupsToTrack, Number(event.id)) === true) {
        removeGroupFromTrackableGroups(groupsToTrack, event.id);
      } else if (containsValue(groupsToTrack, Number(event.id)) === false) {
        groupToInsert = _.find(addedToGroups, function(o) {
          return o.id === event.id;
        });
        console.log(groupToInsert);
        groupsToTrack.push(groupToInsert);
      }
    })
  );

  // merging actionHandle with messageHandle
  await new Promise((resolve, reject) => {
    merge(messagesHandle, actionsHandle).subscribe({
      error: reject,
      complete: resolve
    });
  });
}

//token to connect to the bot
const token = process.env.BOT_TOKEN;
if (typeof token !== "string") {
  throw new Error("BOT_TOKEN env variable not configured");
}

//bot endpoint
const endpoint =
  process.env.BOT_ENDPOINT || "https://grpc-test.transmit.im:9443";

run(token, endpoint)
  .then(response => console.log(response))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

function containsValue(array, value) {
  valuePresent = false;
  array.map(object => {
    if (Number(object.id) === Number(value)) {
      valuePresent = true;
    }
  });
  return valuePresent;
}

function removeGroupFromTrackableGroups(array, value) {
  groupIndexToRemove = _.findIndex(array, function(o) {
    return o.id === value;
  });
  array.splice(groupIndexToRemove, 1);
}

function sendTextToBot(bot, message) {
  bot.sendText(message.peer, message.text, MessageAttachment.reply(message.id));
}
