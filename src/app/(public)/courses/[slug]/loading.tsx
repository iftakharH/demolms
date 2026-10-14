import { LoadingPanel } from '@/components/ui/loading-panel';

export default function CourseDetailLoading() {
  return <LoadingPanel title="Loading the course" lines={3} />;
}
