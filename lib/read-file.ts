export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Kandungan fail tidak dapat dibaca sebagai teks.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca fail.'))
    reader.onabort = () => reject(new Error('Pembacaan fail dibatalkan.'))
    reader.readAsText(file)
  })
}