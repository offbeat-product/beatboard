import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `BeatBoard | ${title}`;
  }, [title]);
}
