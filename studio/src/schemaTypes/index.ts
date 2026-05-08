import blockContent from './objects/blockContent'
import seo from './objects/seo'
import post from './documents/post'
import comment from './documents/comment'

// Export an array of all the schema types.  This is used in the Sanity Studio configuration. https://www.sanity.io/docs/schema-types

export const schemaTypes = [post, comment, blockContent, seo]
