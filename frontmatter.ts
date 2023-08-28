import { createContext, useContext } from "react";

export const FrontmatterContext = createContext<any>({});
export const useFrontmatter = () => useContext(FrontmatterContext);
