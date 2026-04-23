let ffmpegSingleton = null

export const getFfmpeg = async () => {
  if (ffmpegSingleton) return ffmpegSingleton

  ffmpegSingleton = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
    const ffmpeg = new FFmpeg()
    const esmBaseUrls = [
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
      'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
    ]
    let lastError = null

    for (const baseUrl of esmBaseUrls) {
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm'),
        })
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) throw lastError
    return ffmpeg
  })()

  return ffmpegSingleton
}
