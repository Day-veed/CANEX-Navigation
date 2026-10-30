import PDFKit
import AppKit
// usage: raw <pdf> <pageIndex1> <out.png> <scale> <canvasW> <canvasH> <offX> <offY>
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let page = doc.page(at: Int(a[2])! - 1)!
print("media", page.bounds(for: .mediaBox), "crop", page.bounds(for: .cropBox))
let s = CGFloat(Double(a[4])!), W = CGFloat(Double(a[5])!), H = CGFloat(Double(a[6])!)
let ox = CGFloat(Double(a[7])!), oy = CGFloat(Double(a[8])!)
let pw = Int(W*s), ph = Int(H*s)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pw, pixelsHigh: ph, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
let cg = ctx.cgContext
cg.setFillColor(NSColor.white.cgColor); cg.fill(CGRect(x: 0, y: 0, width: pw, height: ph))
cg.scaleBy(x: s, y: s); cg.translateBy(x: ox, y: oy)
page.draw(with: .mediaBox, to: cg)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
