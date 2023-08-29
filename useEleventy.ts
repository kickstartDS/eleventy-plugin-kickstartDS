import { createContext, useContext } from "react";

export const EleventyContext = createContext<any>(null);
export const useEleventy = () => {
  const ctx = useContext(EleventyContext);
  if (ctx == null) {
    throw "Missing EleventyContext";
  }
  return ctx;
};
