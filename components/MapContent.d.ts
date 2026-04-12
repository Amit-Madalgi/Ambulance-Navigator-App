declare module '@/components/MapContent' {
  type MapContentProps = {
    destinationLat: number;
    destinationLng: number;
    onBack: () => void;
  };

  export default function MapContent(props: MapContentProps): JSX.Element;
}
