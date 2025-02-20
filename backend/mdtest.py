from markitdown import MarkItDown

md = MarkItDown()
data_dir = "C:/Users/ShaiS/folder_bot_workspace/Shai2/resolutions/undated"

import os


for filename in os.listdir(data_dir):

    file_path = os.path.join(data_dir, filename)
    result = md.convert(file_path)
    print(f"{filename}:\n\n {result.text_content}\n\n")
