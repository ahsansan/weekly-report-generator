import { useMemo, useState } from 'react'
import { Download, ExternalLink, ImageDown, RefreshCcw, Search, Video } from 'lucide-react'
import '../App.css'

const SAMPLE_URL = 'https://www.instagram.com/p/DQUcbetCRW8/'
const MAX_CAROUSEL_ITEMS = 10

const toSafeName = (value = 'media') => {
  const normalized = value
    .replace(/^@/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'media'
}

const getInstagramShortcode = (value) => {
  const trimmed = value.trim()
  const match = trimmed.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
  if (match) return match[1]
  const shortcodeMatch = trimmed.match(/\b([a-zA-Z0-9_-]{8,20})\b/)
  return shortcodeMatch?.[1] ?? ''
}

const getInstagramPostType = (value) => {
  if (/instagram\.com\/reel\//i.test(value)) return 'reel'
  if (/instagram\.com\/tv\//i.test(value)) return 'tv'
  return 'post'
}

const getVxInstagramPath = (postType) => {
  if (postType === 'reel') return 'reel'
  if (postType === 'tv') return 'tv'
  return 'p'
}

const getDirectExtension = (url, type) => {
  if (type === 'video') return 'mp4'
  try {
    const pathname = new URL(url).pathname
    const extension = pathname.match(/\.(jpg|jpeg|png|webp)$/i)?.[1]
    return extension ? extension.toLowerCase().replace('jpeg', 'jpg') : 'jpg'
  } catch {
    return type === 'video' ? 'mp4' : 'jpg'
  }
}

const createMediaItem = ({ url, type, shortcode = 'media', source = 'Instagram', index = 0 }) => {
  const safeShortcode = toSafeName(shortcode)
  const extension = getDirectExtension(url, type)

  return {
    id: `${type}-${index}-${url}`,
    type,
    url,
    source,
    shortcode: safeShortcode,
    fileName: `ToolsKejepangan-IG-${safeShortcode}-${type}-${index + 1}.${extension}`,
    label: type === 'video' ? 'Video HD' : 'Photo HD',
  }
}

const createExternalItem = ({ url, shortcode, index = 0 }) => ({
  id: `external-${index}-${url}`,
  type: 'external',
  url,
  source: 'Instagram',
  shortcode: toSafeName(shortcode),
  fileName: `ToolsKejepangan-IG-${toSafeName(shortcode)}-reel-link.html`,
  label: 'Open Reel',
})

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
    const isInstagramImage = /cdninstagram\.com|fbcdn\.net|instagram\.f/i.test(cleanedUrl) && /\.(jpg|jpeg|png|webp)(?:\?|$)/i.test(cleanedUrl)
    const isInstagramVideo = /cdninstagram\.com|fbcdn\.net|instagram\.f/i.test(cleanedUrl) && /\.mp4(?:\?|$)/i.test(cleanedUrl)

    if (isInstagramImage) {
      items.push(createMediaItem({ url: cleanedUrl, type: 'photo', source: 'Direct CDN', index }))
    }
    if (isInstagramVideo) {
      items.push(createMediaItem({ url: cleanedUrl, type: 'video', source: 'Direct CDN', index }))
    }
  })

  return uniqueByUrl(items)
}

const getInstagramMediaCount = async (shortcode, postType) => {
  const vxPath = getVxInstagramPath(postType)
  const readerUrl = `https://r.jina.ai/http://https://www.vxinstagram.com/${vxPath}/${shortcode}/`
  const response = await fetch(readerUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('Metadata Instagram tidak tersedia.')

  const text = await response.text()
  const imageCount = (text.match(/!\[Image \d+:\s*Instagram post]/gi) ?? []).length
  const videoCount = (text.match(/!\[Video \d+:\s*Instagram post]/gi) ?? []).length
  const downloadCount = (text.match(/\[Download]\(/gi) ?? []).length
  const mediaCount = Math.max(imageCount, videoCount, downloadCount)
  const mediaType = videoCount > 0 || postType === 'reel' || postType === 'tv' ? 'video' : 'photo'

  if (mediaCount > 0) return { count: Math.min(mediaCount, MAX_CAROUSEL_ITEMS), mediaType }
  return { count: postType === 'reel' || postType === 'tv' ? 1 : 0, mediaType }
}

const getInstagramOembedMeta = async (inputUrl) => {
  const response = await fetch(`https://graph.facebook.com/v16.0/instagram_oembed?url=${encodeURIComponent(inputUrl)}`)
  if (!response.ok) throw new Error('OEmbed Instagram tidak tersedia.')
  const data = await response.json()
  const permalink = String(data?.html ?? '').match(/data-instgrm-permalink="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') ?? ''
  return {
    canonicalUrl: permalink || inputUrl,
    postType: getInstagramPostType(permalink || inputUrl),
  }
}

const createOffloadItems = (shortcode, mediaType, itemCount) => {
  return Array.from({ length: itemCount }, (_, index) =>
    createMediaItem({
      url: `https://www.vxinstagram.com/offload/${shortcode}/${index}`,
      type: mediaType,
      shortcode,
      source: 'Instagram public post',
      index,
    }),
  )
}

const downloadViaAnchor = (item) => {
  const link = document.createElement('a')
  link.href = item.url
  link.download = item.fileName
  link.target = '_blank'
  link.rel = 'noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function InstagramFeedDownloaderTool() {
  const [inputUrl, setInputUrl] = useState(SAMPLE_URL)
  const [items, setItems] = useState([])
  const [failedIds, setFailedIds] = useState([])
  const [loadedIds, setLoadedIds] = useState([])
  const [status, setStatus] = useState('Paste link post/reel Instagram publik atau URL CDN media.')
  const [isResolving, setIsResolving] = useState(false)

  const visibleItems = useMemo(
    () => items.filter((item) => (item.type === 'external' || loadedIds.includes(item.id)) && !failedIds.includes(item.id)),
    [failedIds, items, loadedIds],
  )
  const summary = useMemo(() => {
    const videos = visibleItems.filter((item) => item.type === 'video').length
    const photos = visibleItems.filter((item) => item.type === 'photo').length
    return { videos, photos, loaded: loadedIds.length }
  }, [loadedIds.length, visibleItems])

  const mediaStatus = useMemo(() => {
    if (items.length === 0) return status
    const externalCount = items.filter((item) => item.type === 'external').length
    const checkedCount = loadedIds.length + failedIds.length + externalCount
    if (checkedCount < items.length) {
      return `Mengecek media Instagram... ${checkedCount}/${items.length} slot dicek.`
    }
    if (visibleItems.length === 0) {
      return 'Tidak ada media publik yang bisa dimuat. Coba direct CDN URL atau post publik lain.'
    }
    const videoCount = visibleItems.filter((item) => item.type === 'video').length
    const photoCount = visibleItems.filter((item) => item.type === 'photo').length
    const visibleExternalCount = visibleItems.filter((item) => item.type === 'external').length
    if (visibleExternalCount > 0 && videoCount === 0 && photoCount === 0) {
      return 'Reel terdeteksi, tapi provider download tidak expose file MP4 untuk post ini.'
    }
    return `${visibleItems.length} media siap: ${videoCount} video, ${photoCount} foto.`
  }, [failedIds.length, items, loadedIds.length, status, visibleItems])
  const statusType = /gagal|tidak ada|tidak valid|error/i.test(mediaStatus) ? 'error' : 'success'

  const markLoaded = (id) => {
    setLoadedIds((current) => (current.includes(id) ? current : [...current, id]))
  }

  const markFailed = (id) => {
    setFailedIds((current) => (current.includes(id) ? current : [...current, id]))
  }

  const resolveMedia = async () => {
    if (isResolving) return

    setIsResolving(true)
    setFailedIds([])
    setLoadedIds([])

    const directItems = parseDirectMediaUrls(inputUrl)

    if (directItems.length > 0) {
      setItems(directItems)
      setStatus(`${directItems.length} direct media Instagram ditemukan.`)
      setIsResolving(false)
      return
    }

    const shortcode = getInstagramShortcode(inputUrl)
    if (!shortcode) {
      setItems([])
      setStatus('Link Instagram tidak valid.')
      setIsResolving(false)
      return
    }

    try {
      const oembedMeta = await getInstagramOembedMeta(inputUrl).catch(() => null)
      const postType = oembedMeta?.postType ?? getInstagramPostType(inputUrl)
      setStatus('Mengambil metadata jumlah media Instagram...')
      const { count: mediaCount, mediaType } = await getInstagramMediaCount(shortcode, postType)

      if (mediaCount === 0) {
        if (postType === 'reel' || postType === 'tv') {
          setItems([createExternalItem({ url: oembedMeta?.canonicalUrl ?? `https://www.instagram.com/reel/${shortcode}/`, shortcode })])
          setStatus('Reel terdeteksi, tapi file video tidak tersedia dari provider download.')
          return
        }
        setItems([])
        setStatus('Metadata tidak menemukan media publik untuk post ini.')
        return
      }

      const nextItems = createOffloadItems(shortcode, mediaType, mediaCount)
      setItems(nextItems)
      setStatus(mediaType === 'photo' ? `Mengecek ${mediaCount} media feed/carousel...` : 'Mengecek media video...')
    } catch {
      const oembedMeta = await getInstagramOembedMeta(inputUrl).catch(() => null)
      const postType = oembedMeta?.postType ?? getInstagramPostType(inputUrl)
      if (postType === 'reel' || postType === 'tv') {
        setItems([createExternalItem({ url: oembedMeta?.canonicalUrl ?? `https://www.instagram.com/reel/${shortcode}/`, shortcode })])
        setStatus('Reel terdeteksi, tapi metadata MP4 gagal dibaca.')
        return
      }
      const fallbackType = postType === 'reel' || postType === 'tv' ? 'video' : 'photo'
      const nextItems = createOffloadItems(shortcode, fallbackType, 1)
      setItems(nextItems)
      setStatus('Metadata gagal dibaca. Menampilkan media pertama sebagai fallback.')
    } finally {
      setIsResolving(false)
    }
  }

  const downloadItem = (item) => {
    if (item.type === 'external') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      setStatus('Reel dibuka di Instagram karena MP4 tidak tersedia dari provider.')
      return
    }
    downloadViaAnchor(item)
    setStatus(`${item.fileName} dibuka untuk download.`)
  }

  const clearAll = () => {
    setInputUrl('')
    setItems([])
    setFailedIds([])
    setLoadedIds([])
    setStatus('Input dikosongkan.')
  }

  const loadSample = () => {
    setInputUrl(SAMPLE_URL)
    setItems([])
    setFailedIds([])
    setLoadedIds([])
    setStatus('Sample post dimuat.')
  }

  return (
    <main className="page instagram-feed-page">
      <section className="hero instagram-feed-hero" style={{ '--theme-color': '#dd2a7b' }}>
        <div className="hero-left">
          <div className="hero-icon" aria-hidden="true">
            <ImageDown className="icon-md" />
          </div>
          <div>
            <h1>Instagram Feed Downloader</h1>
            <p>Download foto feed, carousel, dan reel dari post Instagram publik.</p>
          </div>
        </div>
        <div className="shortcut-box">
          <span>MEDIA</span>
          <code>{summary.videos} video</code>
          <code>{summary.photos} foto</code>
        </div>
      </section>

      <section className="card twitter-media-card instagram-feed-card">
        <div className="instagram-feed-input-grid">
          <label className="field instagram-feed-url-field">
            <span>Instagram Post / Reel URL</span>
            <input
              value={inputUrl}
              onChange={(event) => setInputUrl(event.target.value)}
              placeholder="https://www.instagram.com/p/SHORTCODE/ atau /reel/SHORTCODE/"
            />
          </label>

          <div className="twitter-media-actions instagram-feed-actions">
            <button type="button" className="primary icon-btn" onClick={resolveMedia} disabled={isResolving}>
              <Search className="icon-sm" /> {isResolving ? 'Resolving...' : 'Get Feed Media'}
            </button>
            <button type="button" className="outline icon-btn" onClick={loadSample} disabled={isResolving}>
              <RefreshCcw className="icon-sm" /> Sample
            </button>
            <button type="button" className="outline icon-btn" onClick={clearAll} disabled={isResolving}>
              Clear
            </button>
          </div>
        </div>

        <p className={`twitter-media-status instagram-feed-status ${statusType}`}>{mediaStatus}</p>

        <article className="instagram-feed-note">
          <strong>Filename default</strong>
          <p>ToolsKejepangan-IG-SHORTCODE-photo-1.jpg</p>
        </article>

        {items.length > 0 ? (
          <div className="twitter-media-result-grid instagram-feed-result-grid">
            {items.map((item) => (
              <article
                key={item.id}
                className={`twitter-media-result-card instagram-feed-result-card ${
                  item.type === 'external' || loadedIds.includes(item.id) ? '' : 'is-checking'
                } ${failedIds.includes(item.id) ? 'is-hidden' : ''}`}
              >
                <div className="twitter-media-preview instagram-feed-preview">
                  {item.type === 'external' ? (
                    <div className="instagram-feed-external-preview">
                      <Video className="icon-md" />
                      <span>MP4 tidak tersedia</span>
                    </div>
                  ) : item.type === 'video' ? (
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      onLoadedMetadata={() => markLoaded(item.id)}
                      onError={() => markFailed(item.id)}
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.fileName}
                      loading="lazy"
                      onLoad={() => markLoaded(item.id)}
                      onError={() => markFailed(item.id)}
                    />
                  )}
                  <span className={`twitter-media-type ${item.type}`}>
                    {item.type === 'video' || item.type === 'external' ? <Video className="icon-xs" /> : <ImageDown className="icon-xs" />}
                    {item.label}
                  </span>
                </div>

                <div className="twitter-media-result-body">
                  <div>
                    <strong>{item.fileName}</strong>
                    <p>{item.source} / item {Number(item.fileName.match(/-(\d+)\.[^.]+$/)?.[1] ?? 1)}</p>
                  </div>
                  <div className="twitter-media-result-actions">
                    <button type="button" className="primary icon-btn" onClick={() => downloadItem(item)}>
                      {item.type === 'external' ? <ExternalLink className="icon-sm" /> : <Download className="icon-sm" />}
                      {item.type === 'external' ? 'Open Reel' : 'Download'}
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

export default InstagramFeedDownloaderTool
