import { SignJWT, jwtVerify } from "jose";
import { config } from "../config";

const jwtSecret = new TextEncoder().encode(config.APP_JWT_SECRET);

export interface SessionClaims {
  sub: string;
  email: string;
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(claims.sub)
    .setExpirationTime("30d")
    .sign(jwtSecret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const result = await jwtVerify(token, jwtSecret);
  return {
    sub: result.payload.sub ?? "",
    email: String(result.payload.email ?? "")
  };
}
