import { useEleventy } from "../useEleventy";

export const Title = () => {
  const data = useEleventy();
  return (
    <p>
      The title of the page is <b>{data.title}</b>
    </p>
  );
};
