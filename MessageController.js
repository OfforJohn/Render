import { renameSync } from "fs";
import getPrismaInstance from "./PrismaClient.js";

export const getMessages = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();
    const { from, to } = req.params;
    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          {
            senderId: parseInt(from),
            recieverId: parseInt(to),
          },
          {
            senderId: parseInt(to),
            recieverId: parseInt(from),
          },
        ],
      },
      orderBy: {
        id: "asc",
      },
    });
    const unreadMessages = [];

    messages.forEach((message, index) => {
      if (
        message.messageStatus !== "read" &&
        message.senderId === parseInt(to)
      ) {
        messages[index].messageStatus = "read";
        unreadMessages.push(message.id);
      }
    });

    await prisma.messages.updateMany({
      where: {
        id: { in: unreadMessages },
      },
      data: {
        messageStatus: "read",
      },
    });
    res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
};



export const addMessage = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();

    const { message, from, to } = req.body;
    const getUser = onlineUsers.get(to);

    if (message && from && to) {
      const newMessage = await prisma.messages.create({
        data: {
          message: message,
          sender: { connect: { id: parseInt(from) } },
          reciever: { connect: { id: parseInt(to) } },
          messageStatus: getUser ? "delivered" : "sent",
        },
        include: { sender: true, reciever: true },
      });
      return res.status(201).send({ message: newMessage });
    }
    return res.status(400).send("From, to and Message is required.");
  } catch (err) {
    next(err);
  }
};

export const getInitialContactsWithMessages = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.from);
    console.log(`🔍 Fetching messages for userId: ${userId}`);

    const prisma = getPrismaInstance();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sentMessages: {
          include: { reciever: true, sender: true },
          orderBy: { createdAt: "desc" },
        },
        recievedMessages: {
          include: { reciever: true, sender: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      console.log("❌ User not found.");
      return res.status(404).json({ message: "User not found." });
    }

    console.log(`✅ User found. Sent messages: ${user.sentMessages.length}, Received messages: ${user.recievedMessages.length}`);

    const messages = [...user.sentMessages, ...user.recievedMessages];
    messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    console.log(`📦 Total messages combined and sorted: ${messages.length}`);

    const users = new Map();
    const messageStatusChange = [];

    messages.forEach((msg) => {
      const isSender = msg.senderId === userId;
      const calculatedId = isSender ? msg.recieverId : msg.senderId;

      console.log(`🗂️ Processing message ID: ${msg.id}, isSender: ${isSender}, contactId: ${calculatedId}`);

      if (msg.messageStatus === "sent") {
        messageStatusChange.push(msg.id);
        console.log(`📬 Message ID ${msg.id} status marked for "delivered"`);
      }

      if (!users.get(calculatedId)) {
        let userObj = {
          messageId: msg.id,
          type: msg.type,
          message: msg.message,
          messageStatus: msg.messageStatus,
          createdAt: msg.createdAt,
          senderId: msg.senderId,
          recieverId: msg.recieverId,
        };

        if (isSender) {
          userObj = {
            ...userObj,
            ...msg.reciever,
            totalUnreadMessages: 0,
          };
        } else {
          userObj = {
            ...userObj,
            ...msg.sender,
            totalUnreadMessages: msg.messageStatus !== "read" ? 1 : 0,
          };
        }

        users.set(calculatedId, userObj);
        console.log(`👤 Added new contact to map: ${calculatedId}, unread: ${userObj.totalUnreadMessages}`);
      } else if (msg.messageStatus !== "read" && !isSender) {
        const existingUser = users.get(calculatedId);
        users.set(calculatedId, {
          ...existingUser,
          totalUnreadMessages: existingUser.totalUnreadMessages + 1,
        });
        console.log(`🔄 Updated unread count for user ${calculatedId}: ${existingUser.totalUnreadMessages + 1}`);
      }
    });

    if (messageStatusChange.length) {
      await prisma.messages.updateMany({
        where: {
          id: { in: messageStatusChange },
        },
        data: {
          messageStatus: "delivered",
        },
      });
      console.log(`✅ Updated ${messageStatusChange.length} message(s) to "delivered" status.`);
    } else {
      console.log("ℹ️ No message status updates required.");
    }

    console.log(`📤 Sending response with ${users.size} contacts.`);
    return res.status(200).json({
      users: Array.from(users.values()),
      onlineUsers: Array.from(onlineUsers.keys()),
    });

  } catch (err) {
    console.error("🚨 Error in getInitialContactsWithMessages:", err);
    next(err);
  }
};




export const addAudioMessage = async (req, res, next) => {
  try {
    if (req.file) {
      const date = Date.now();
      let fileName = "uploads/recordings/" + date + req.file.originalname;
      renameSync(req.file.path, fileName);
      const prisma = getPrismaInstance();
      const { from, to } = req.query;
      if (from && to) {
        const message = await prisma.messages.create({
          data: {
            message: fileName,
            sender: { connect: { id: parseInt(from) } },
            reciever: { connect: { id: parseInt(to) } },
            type: "audio",
          },
        });
        return res.status(201).json({ message });
      }
      return res.status(400).send("From, to is required.");
    }
    return res.status(400).send("Audio is required.");
  } catch (err) {
    next(err);
  }
};

export const addImageMessage = async (req, res, next) => {
  try {
    if (req.file) {
      const date = Date.now();
      let fileName = "uploads/images/" + date + req.file.originalname;
      renameSync(req.file.path, fileName);
      const prisma = getPrismaInstance();
      const { from, to } = req.query;
      if (from && to) {
        const message = await prisma.messages.create({
          data: {
            message: fileName,
            sender: { connect: { id: parseInt(from) } },
            reciever: { connect: { id: parseInt(to) } },
            type: "image",
          },
        });
        return res.status(201).json({ message });
      }
      return res.status(400).send("From, to is required.");
    }
    return res.status(400).send("Image is required.");
  } catch (err) {
    next(err);
  }
};
