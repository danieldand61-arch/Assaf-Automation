import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

interface ProductVideoProps {
  title: string
  description: string
  price: number
  imageUrl: string
}

export const ProductVideo: React.FC<ProductVideoProps> = ({
  title,
  description,
  price,
  imageUrl
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Image animation: fade in + scale up (0-1s)
  const imageOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const imageScale = spring({
    frame: frame - 20,
    fps,
    from: 0.8,
    to: 1,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  })

  // Title animation: slide in from right (1-2s)
  const titleX = interpolate(frame, [30, 60], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const titleOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Description animation: slide in from bottom (2-3s)
  const descY = interpolate(frame, [60, 90], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const descOpacity = interpolate(frame, [60, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Price animation: pulse (3-4s)
  const priceScale = spring({
    frame: frame - 90,
    fps,
    from: 0.8,
    to: 1,
    config: {
      damping: 10,
      stiffness: 300,
      mass: 0.3,
    },
  })

  const priceOpacity = interpolate(frame, [90, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '80px',
        }}
      >
        {/* Product Image */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
          }}
        >
          <img
            src={imageUrl}
            style={{
              maxWidth: '500px',
              maxHeight: '500px',
              objectFit: 'contain',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          />
        </div>

        {/* Product Info */}
        <div
          style={{
            flex: 1,
            paddingLeft: '60px',
          }}
        >
          {/* Title */}
          <h1
            style={{
              fontSize: '80px',
              fontWeight: 'bold',
              color: '#1a1a1a',
              marginBottom: '30px',
              opacity: titleOpacity,
              transform: `translateX(${titleX}px)`,
            }}
          >
            {title}
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '40px',
              color: '#666',
              marginBottom: '40px',
              lineHeight: 1.5,
              opacity: descOpacity,
              transform: `translateY(${descY}px)`,
            }}
          >
            {description}
          </p>

          {/* Price */}
          <div
            style={{
              fontSize: '70px',
              fontWeight: 'bold',
              color: '#0066ff',
              opacity: priceOpacity,
              transform: `scale(${priceScale})`,
              transformOrigin: 'left center',
            }}
          >
            ${price}
          </div>
        </div>
      </div>

      {/* Brand watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '40px',
          fontSize: '24px',
          color: '#999',
          opacity: interpolate(frame, [120, 150], [0, 0.5], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        Created with AI Platform
      </div>
    </AbsoluteFill>
  )
}
