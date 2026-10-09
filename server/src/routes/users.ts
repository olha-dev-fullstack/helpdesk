import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/users";

export const usersRouter = Router();

usersRouter.get("/", listUsers);
usersRouter.post("/", createUser);
usersRouter.patch("/:id", updateUser);
usersRouter.delete("/:id", deleteUser);
