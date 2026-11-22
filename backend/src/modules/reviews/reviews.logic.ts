// Pure calculations for the reputation report.

export interface ReportReview {
  rating: number
  postedAt: Date
  publicReplyAt: Date | null
}

const median = (values: number[]) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

// Volume, average, distribution and replies for the reviews posted in the period. Every figure has its
// denominator beside it, so a small sample is never mistaken for a trend.
export function reputationMetrics(reviews: ReportReview[]) {
  const total = reviews.length
  const average = total ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / total) * 10) / 10 : null
  const replied = reviews.filter((review) => review.publicReplyAt)
  const hours = replied.map((review) => Math.max(0, (review.publicReplyAt!.getTime() - review.postedAt.getTime()) / 3_600_000))
  const medianHours = median(hours)
  return {
    total,
    average,
    distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((review) => review.rating === star).length })),
    replied: replied.length,
    medianReplyHours: medianHours === null ? null : Math.round(medianHours * 10) / 10,
  }
}

// Reviews per day in clinic time, for each day of the period that had any.
export function byDay(reviews: ReportReview[], localDate: (instant: Date) => string) {
  const counts = new Map<string, number>()
  for (const review of reviews) {
    const day = localDate(review.postedAt)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
}
