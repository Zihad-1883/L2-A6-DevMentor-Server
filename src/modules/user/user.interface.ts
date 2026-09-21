/**
 * @file src/modules/user/user.interface.ts
 * @description Interfaces for user profile updates and dashboard views.
 */

export interface IUpdateUserProfileInput {
  name?: string;
  image?: string;
  bio?: string;
}
