import getPrismaInstance from "./PrismaClient.js";
import { generateToken04 } from "./TokenGenerator.js";
import { generateReplies } from "./generateReplies.js";

import { faker } from "@faker-js/faker";


export const checkUser = async (request, response, next) => {
  try {
    const { email } = request.body;
    if (!email) {
      return response.json({ msg: "Email is required", status: false });
    }
    const prisma = getPrismaInstance();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return response.json({ msg: "User not found", status: false });
    } else
      return response.json({ msg: "User Found", status: true, data: user });
  } catch (error) {
    next(error);
  }
};


export const deleteUser = async (req, res, next) => {
  try {
    3;
    const id = parseInt(req.params.id);

    const prisma = getPrismaInstance();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ msg: "User not found", status: false });
    }

    await prisma.user.delete({ where: { id } });

    return res
      .status(200)
      .json({ msg: "User deleted successfully", status: true });
  } catch (error) {
    next(error);
  }
};

export const addUser = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();

    // Destructure the required data from the request body
    const { email, name, profilePicture, about } = req.body;

    if (email && name) {
      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          profilePicture: profilePicture || "/default_avatar.png", // Optional, default to a placeholder if not provided
          about: about || "", // Optional, default to an empty string if not provided
        },
      });
      return res.status(201).json({ user: newUser });
    }
    return res.status(400).send("Email and name are required.");
  } catch (err) {
    next(err);
  }
};


export const addTenUsersWithCustomIds = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();

    const { startingId = 1, contacts = [] } = req.body;

    if (!contacts.length) {
      return res.status(400).json({ error: "No contacts provided." });
    }

    const arrayOfUserObjects = contacts.map((nameOrNumber, index) => {
      const id = startingId + index;
      const email = `user${id}@example.com`;
      const profilePicture = `/avatars/${Math.floor(Math.random() * 1000) + 1}.png`;

      return {
        id,
        email,
        name: nameOrNumber,
        profilePicture,
        about: "",
      };
    });

    const result = await prisma.user.createMany({
      data: arrayOfUserObjects,
      skipDuplicates: true,
    });

    return res.status(201).json({
      message: `${result.count} contacts created successfully.`,
    });
  } catch (err) {
    next(err);
  }
};


export const deleteBatchUsers = async (req, res, next) => {
  try {
    const startId = parseInt(req.params.startId);
    const prisma = getPrismaInstance();

    const idsToDelete = Array.from({ length: 1500 }, (_, i) => startId + i);

    // First, delete all messages related to these users
    await prisma.messages.deleteMany({
      where: {
        OR: [
          { senderId: { in: idsToDelete } },
          { recieverId: { in: idsToDelete } },
        ],
      },
    });

    // Now delete the users
    const result = await prisma.user.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    });

    return res.status(200).json({
      message: `Contacts deleted.`,
      deletedCount: result.count,
    });
  } catch (err) {
    next(err);
  }
};

export const addUserWithCustomId = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();
    const { id, email, name, profilePicture, about } = req.body;

    if (!id || id < 100) {
      return res.status(400).json({ msg: "ID must be provided and >= 100" });
    }

    if (!email || !name) {
      return res.status(400).json({ msg: "Email and name are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (existingUser) {
      return res.status(409).json({ msg: "User ID already exists" });
    }

    const newUser = await prisma.user.create({
      data: {
        id,
        email,
        name,
        profilePicture: profilePicture || "/default_avatar.png",
        about: about || "",
      },
    });

    return res.status(201).json({ user: newUser });
  } catch (err) {
    next(err);
  }
};


export const broadcastMessageToAll = async (req, res, next) => {
  try {
    const { message, senderId } = req.body;
    if (!message || !senderId) {
      console.log("❌ Missing message or senderId");
      return res.status(400).json({ message: "Both message and senderId are required." });
    }

    const prisma = getPrismaInstance();
    const SYSTEM_USER_ID = 100;

    // Fetch all users excluding the system user
    const users = await prisma.user.findMany({
      where: { id: { not: SYSTEM_USER_ID } },
      select: { id: true },
    });

    if (users.length === 0) {
      console.log("ℹ️ No real users found.");
      return res.status(200).json({ message: "No users to broadcast to.", status: true });
    }

    // Step 1: Send original message from sender to each user
    for (const user of users) {
      await prisma.messages.create({
        data: {
          senderId,
          recieverId: user.id,
          message,
        },
      });
    }// AuthController.js
const botCount = Math.min(Math.max(parseInt(req.body.botCount || 8), 1), 100); // Allow 1 to 100 bots max
const botSenderIds = Array.from({ length: botCount }, (_, i) => i + 3);

const botReplies = await prisma.botReply.findMany();
generateReplies.setReplies(botReplies);

// Get exactly 8 replies, one per bot
const repliesForBots = generateReplies.getNextNReplies(botSenderIds.length);
console.log("📦 Unique bot replies to be sent:", repliesForBots);

if (repliesForBots.length < botSenderIds.length) {
  console.warn("⚠️ Not enough replies to match all bots. Some bots will not send.");
}

const allMessages = [];

for (let i = 0; i < repliesForBots.length; i++) {
  const botId = botSenderIds[i];
  const reply = repliesForBots[i];

  for (const user of users) {
    allMessages.push({
      senderId: botId,
      recieverId: user.id,
      message: reply,
    });
  }
}


    // Step 4: Insert messages in chunks
    const CHUNK_SIZE = 13;
    for (let i = 0; i < allMessages.length; i += CHUNK_SIZE) {
      const chunk = allMessages.slice(i, i + CHUNK_SIZE);
      await prisma.messages.createMany({ data: chunk, skipDuplicates: false });
    }

    console.log("🎉 All messages sent.");
    return res.status(200).json({ message: "Broadcasted.", status: true });

  } catch (err) {
    console.error("❌ Broadcast error:", err);
    next(err);
  }
}; 


export const onBoardUser = async (request, response, next) => {
  try {
    const {
      email,
      name,
      about = "Available",
      image: profilePicture,
    } = request.body;
    if (!email || !name || !profilePicture) {
      return response.json({
        msg: "Email, Name and Image are required",
      });
    } else {
      const prisma = getPrismaInstance();
      await prisma.user.create({
        data: { email, name, about, profilePicture },
      });
      return response.json({ msg: "Success", status: true });
    }
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    console.log("➡️ getAllUsers function triggered");

    const prisma = getPrismaInstance();
    console.log("✅ Prisma instance created");

    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        about: true,
      },
    });

    console.log("📦 Users fetched from DB:", users.length, "users found");
    // Optional: Uncomment to see full user data
    // console.log("📋 Users data:", users);

    const usersGroupedByInitialLetter = {};
    
    users.forEach((user) => {
      const initialLetter = user.name.charAt(0).toUpperCase();
      console.log(`🔤 Grouping user '${user.name}' under '${initialLetter}'`);

      if (!usersGroupedByInitialLetter[initialLetter]) {
        usersGroupedByInitialLetter[initialLetter] = [];
      }

      usersGroupedByInitialLetter[initialLetter].push(user);
    });

    console.log("✅ Grouped users by initial letter:", Object.keys(usersGroupedByInitialLetter));

    return res.status(200).send({ users: usersGroupedByInitialLetter });
  } catch (error) {
    console.error("❌ Error in getAllUsers:", error);
    next(error);
  }
};


export const generateToken = (req, res, next) => {
  try {
    const appID = parseInt(process.env.ZEGO_APP_ID);
    const serverSecret = process.env.ZEGO_APP_SECRET;
    const userId = req.params.userId;
    const effectiveTimeInSeconds = 3600;
    const payload = "";
    if (appID && serverSecret && userId) {
      const token = generateToken04(
        appID,
        userId,
        serverSecret,
        effectiveTimeInSeconds,
        payload
      );
      res.status(200).json({ token });
    }
    return res
      .status(400)
      .send("User id, app id and server secret is required");
  } catch (err) {
    console.log({ err });
    next(err);
  }
};
