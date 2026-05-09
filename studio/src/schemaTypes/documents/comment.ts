import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'comment',
  title: 'Comment',
  type: 'document',
  fields: [
    defineField({
      name: 'post',
      title: 'Post',
      type: 'reference',
      to: [{type: 'post'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'authorId',
      title: 'Author ID',
      type: 'string',
      description: 'Stable ID from your auth provider.',
      validation: (Rule) => Rule.required().min(1).max(200),
    }),
    defineField({
      name: 'authorName',
      title: 'Author name',
      type: 'string',
      validation: (Rule) => Rule.required().min(1).max(80),
    }),
    defineField({
      name: 'authorEmail',
      title: 'Author email',
      type: 'string',
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'body',
      title: 'Comment',
      type: 'text',
      rows: 6,
      validation: (Rule) => Rule.required().min(1).max(2000),
    }),
    defineField({
      name: 'status',
      title: 'Moderation status',
      type: 'string',
      options: {
        list: [
          {title: 'Pending', value: 'pending'},
          {title: 'Approved', value: 'approved'},
          {title: 'Rejected', value: 'rejected'},
        ],
        layout: 'radio',
      },
      initialValue: 'pending',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'isTrustedAuthorSnapshot',
      title: 'Trusted author (snapshot)',
      type: 'boolean',
      description: 'Whether the author was trusted at submission time.',
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Submitted at',
      type: 'datetime',
      readOnly: true,
      initialValue: () => new Date().toISOString(),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'moderatedAt',
      title: 'Moderated at',
      type: 'datetime',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const status = (context.document as {status?: string} | undefined)?.status
          if (status && status !== 'pending' && !value) {
            return 'Moderated date is required when status is approved or rejected.'
          }
          return true
        }),
    }),
  ],
  preview: {
    select: {
      title: 'authorName',
      subtitle: 'body',
      status: 'status',
    },
    prepare(selection) {
      const {title, subtitle, status} = selection
      return {
        title: title || 'Unknown author',
        subtitle: `${status || 'pending'} - ${subtitle || ''}`.trim(),
      }
    },
  },
})
