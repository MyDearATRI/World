import { PageLayout, SharedLayout } from "./quartz/cfg"
import {
  ReadingHead,
  ReadingRail,
  ReadingHeader,
  ReadingFooter,
  ReadingConnections,
} from "./quartz/components/Reading"

export const sharedPageComponents: SharedLayout = {
  head: ReadingHead,
  header: [],
  afterBody: [ReadingConnections],
  footer: ReadingFooter,
}
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [ReadingHeader],
  left: [ReadingRail],
  right: [],
}
export const defaultListPageLayout: PageLayout = defaultContentPageLayout
