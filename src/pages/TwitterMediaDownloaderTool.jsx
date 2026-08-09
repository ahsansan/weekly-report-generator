import { useMemo, useState } from 'react'
import { Download, ExternalLink, ImageDown, RefreshCcw, Search, Video } from 'lucide-react'
import '../App.css'

const SAMPLE_URL = 'https://x.com/OpenAI/status/1790089525642899678'
const API_BASE_URL = 'https://api.vxtwitter.com/Twitter/status'

const getTweetId = (value) => {
  const trimmed = value.trim()
  const statusMatch = trimmed.match(/(?:x\.com|twitter\.com)\/[^/\s]+\/status\/(\d+)/i)
  if (statusMatch) return statusMatch[1]
  const numberMatch = trimmed.match(/\b(\d{15,25})\b/)
  return numberMatch?.[1] ?? ''
}

const getFileExtension = (url, type) => {
  if (type === 'video') return 'mp4'
  const pathname = new URL(url).pathname
  const extension = pathname.match(/\.(jpg|jpeg|png|webp)$/i)?.[1]
  return extension ? extension.toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

const toSafeUsername = (value = 'Unknown') => {
  const normalized = value
    .replace(/^@/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'Unknown'
}

const getImageHdUrl = (url) => {
  try {
    const parsedUrl = new URL(url)
    if (!/pbs\.twimg\.com$/i.test(parsedUrl.hostname)) return url
    parsedUrl.searchParams.set('name', 'orig')
    return parsedUrl.toString()
  } catch {
    return url
  }
}

const getVideoScore = (url) => {
  const resolutionMatch = url.match(/\/(\d{2,5})x(\d{2,5})\//)
  if (resolutionMatch) return Number(resolutionMatch[1]) * Number(resolutionMatch[2])
  const bitrateMatch = url.match(/\/(\d+)k\//i)
  return bitrateMatch ? Number(bitrateMatch[1]) : 0
}

const createMediaItem = ({ url, type, source = 'Direct URL', username = 'Unknown', thumbnail = '', title = '', index = 0 }) => {
  const hdUrl = type === 'photo' ? getImageHdUrl(url) : url
  const extension = getFileExtension(hdUrl, type)
  const safeUsername = toSafeUsername(username)

  return {
    id: `${type}-${index}-${hdUrl}`,
    type,
    url: hdUrl,
    thumbnail: thumbnail ? getImageHdUrl(thumbnail) : '',
    source,
    title,
    fileName: `ToolsKejepangan-X-${safeUsername}-${type}-${index + 1}.${extension}`,
    quality: type === 'video' ? `${getVideoScore(hdUrl) || 'HD'} score` : 'orig',
  }
}

const uniqueByUrl = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

const parseDirectMediaUrls = (value) => {
  const urlMatches = value.match(/https?:\/\/[^\s"'<>]+/gi) ?? []
  const items = []

  urlMatches.forEach((rawUrl, index) => {
    const cleanedUrl = rawUrl.replace(/[),.;]+$/, '')
    if (/pbs\.twimg\.com\/media\//i.test(cleanedUrl)) {
      items.push(createMediaItem({ url: cleanedUrl, type: 'photo', index }))
    }
    if (/video\.twimg\.com\/.+\.mp4/i.test(cleanedUrl)) {
      items.push(createMediaItem({ url: cleanedUrl, type: 'video', index }))
    }
  })

  return uniqueByUrl(items).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'video' ? -1 : 1
    return getVideoScore(b.url) - getVideoScore(a.url)
  })
}

const normalizeApiMedia = (data) => {
  const extendedMedia = Array.isArray(data?.media_extended) ? data.media_extended : []
  const mediaUrls = Array.isArray(data?.mediaURLs) ? data.mediaURLs : []
  const items = []

  extendedMedia.forEach((media, index) => {
    const type = media.type === 'video' || media.type === 'gif' ? 'video' : 'photo'
    const url = media.url || mediaUrls[index]
    if (!url) return
    items.push(
      createMediaItem({
        url,
        type,
        thumbnail: media.thumbnail_url,
        username: data.user_screen_name,
        source: `@${data.user_screen_name ?? 'twitter'}`,
        title: data.text ?? '',
        index,
      }),
    )
  })

  if (items.length === 0) {
    mediaUrls.forEach((url, index) => {
      const type = /\.mp4(?:\?|$)/i.test(url) ? 'video' : 'photo'
      items.push(
        createMediaItem({
        url,
        type,
        username: data.user_screen_name,
        source: `@${data.user_screen_name ?? 'twitter'}`,
        title: data.text ?? '',
        index,
        }),
      )
    })
  }

  return uniqueByUrl(items).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'video' ? -1 : 1
    return getVideoScore(b.url) - getVideoScore(a.url)
  })
}

const downloadBlob = async (item) => {
  const response = await fetch(item.url)
  if (!response.ok) throw new Error('Media tidak bisa diunduh otomatis.')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = item.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function TwitterMediaDownloaderTool() {
  const [inputUrl, setInputUrl] = useState(SAMPLE_URL)
  const [items, setItems] = useState([])
  const [tweetMeta, setTweetMeta] = useState(null)
  const [status, setStatus] = useState('Paste link tweet X/Twitter atau URL CDN media.')
  const [isLoading, setIsLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState('')

  const summary = useMemo(() => {
    const videos = items.filter((item) => item.type === 'video').length
    const photos = items.filter((item) => item.type === 'photo').length
    return { videos, photos }
  }, [items])

  const resolveMedia = async () => {
    if (isLoading) return
    const directItems = parseDirectMediaUrls(inputUrl)

    if (directItems.length > 0) {
      setItems(directItems)
      setTweetMeta(null)
      setStatus(`${directItems.length} media direct URL ditemukan.`)
      return
    }

    const tweetId = getTweetId(inputUrl)
    if (!tweetId) {
      setItems([])
      setTweetMeta(null)
      setStatus('Link tweet tidak valid.')
      return
    }

    try {
      setIsLoading(true)
      setStatus('Mengambil metadata media...')
      const response = await fetch(`${API_BASE_URL}/${tweetId}`)
      if (!response.ok) throw new Error('Metadata tidak tersedia.')
      const data = await response.json()
      const nextItems = normalizeApiMedia(data)

      setTweetMeta({
        author: data.user_screen_name ? `@${data.user_screen_name}` : 'X/Twitter',
        text: data.text ?? '',
        url: data.tweetURL ?? inputUrl,
      })
      setItems(nextItems)
      setStatus(nextItems.length > 0 ? `${nextItems.length} media HD ditemukan.` : 'Tweet ini tidak punya media publik.')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Gagal mengambil media.'
      setItems([])
      setTweetMeta(null)
      setStatus(reason)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadItem = async (item) => {
    try {
      setDownloadingId(item.id)
      setStatus(`Menyiapkan ${item.fileName}...`)
      await downloadBlob(item)
      setStatus(`${item.fileName} mulai diunduh.`)
    } catch {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      setStatus('Download otomatis diblokir CDN. Media dibuka di tab baru.')
    } finally {
      setDownloadingId('')
    }
  }

  const clearAll = () => {
    setInputUrl('')
    setItems([])
    setTweetMeta(null)
    setStatus('Input dikosongkan.')
  }

  const loadSample = () => {
    setInputUrl(SAMPLE_URL)
    setItems([])
    setTweetMeta(null)
    setStatus('Sample tweet dimuat.')
  }

  return (
    <main className="page twitter-media-page">
      <section className="hero twitter-media-hero" style={{ '--theme-color': '#111827' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <ImageDown className="icon-md" />
          </div>
          <div>
            <h1>Twitter/X HD Media Downloader</h1>
            <p>Ambil foto original dan video kualitas tertinggi dari tweet publik.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>MEDIA</span>
          <code>{summary.videos} video</code>
          <code>{summary.photos} foto</code>
        </div>
      </section>

      <section className="card twitter-media-card">
        <div className="twitter-media-input-grid">
          <label className="field twitter-media-url-field">
            <span>Tweet URL / Media URL</span>
            <input
              value={inputUrl}
              onChange={(event) => setInputUrl(event.target.value)}
              placeholder="https://x.com/user/status/123 atau https://pbs.twimg.com/media/..."
            />
          </label>

          <div className="twitter-media-actions">
            <button type="button" className="primary icon-btn" onClick={resolveMedia} disabled={isLoading}>
              <Search className="icon-sm" /> {isLoading ? 'Resolving...' : 'Get Media HD'}
            </button>
            <button type="button" className="outline icon-btn" onClick={loadSample} disabled={isLoading}>
              <RefreshCcw className="icon-sm" /> Sample
            </button>
            <button type="button" className="outline icon-btn" onClick={clearAll} disabled={isLoading}>
              Clear
            </button>
          </div>
        </div>

        <p className="twitter-media-status">{status}</p>

        {tweetMeta ? (
          <article className="twitter-media-meta">
            <strong>{tweetMeta.author}</strong>
            <p>{tweetMeta.text || tweetMeta.url}</p>
          </article>
        ) : null}

        {items.length > 0 ? (
          <div className="twitter-media-result-grid">
            {items.map((item) => (
              <article key={item.id} className="twitter-media-result-card">
                <div className="twitter-media-preview">
                  {item.type === 'video' ? (
                    <video src={item.url} poster={item.thumbnail} controls preload="metadata" />
                  ) : (
                    <img src={item.url} alt={item.title || item.fileName} loading="lazy" />
                  )}
                  <span className={`twitter-media-type ${item.type}`}>
                    {item.type === 'video' ? <Video className="icon-xs" /> : <ImageDown className="icon-xs" />}
                    {item.type === 'video' ? 'Video HD' : 'Photo Orig'}
                  </span>
                </div>

                <div className="twitter-media-result-body">
                  <div>
                    <strong>{item.fileName}</strong>
                    <p>{item.source} · {item.quality}</p>
                  </div>
                  <div className="twitter-media-result-actions">
                    <button
                      type="button"
                      className="primary icon-btn"
                      onClick={() => downloadItem(item)}
                      disabled={downloadingId === item.id}
                    >
                      <Download className="icon-sm" /> {downloadingId === item.id ? 'Downloading...' : 'Download'}
                    </button>
                    <a href={item.url} target="_blank" rel="noreferrer" className="outline icon-btn">
                      <ExternalLink className="icon-sm" /> Open
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default TwitterMediaDownloaderTool
