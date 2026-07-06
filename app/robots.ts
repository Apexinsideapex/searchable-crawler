import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/private/'],
      },
      {
        userAgent: 'Google-Extended',
        disallow: ['/private/'],
      }
    ],
  }
}