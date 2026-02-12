import { Composition } from 'remotion'
import { ProductVideo } from './ProductVideo'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductVideo"
        component={ProductVideo as any}
        durationInFrames={150}  // 5 seconds at 30 fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Product Name',
          description: 'Amazing product description that highlights key features',
          price: 999,
          imageUrl: 'https://via.placeholder.com/500x500/4A90E2/ffffff?text=Product'
        }}
      />
    </>
  )
}
