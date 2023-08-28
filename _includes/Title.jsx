import { useFrontmatter } from "../frontmatter";

export const Title = () => {
  const frontmatter = useFrontmatter();
  return (
    <p>
      The title of the page is <b>{frontmatter.title}</b>
    </p>
  );
};
