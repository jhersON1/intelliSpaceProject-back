import { ValidRoles } from "./valid-roles.interface";

export interface JwtPayload {
  email: string;
  id: string;
  rol: string;

  //TODO: añadir todo lo que quieran grabar.
}
