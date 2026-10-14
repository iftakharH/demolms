import { LoadingPanel } from '@/components/ui/loading-panel';

export default function CoursesLoading() {
  return <LoadingPanel title="Loading the catalogue" lines={2} cards={6} />;
}
